// Issue #17: classify activities with a validate-and-retry loop.
import type Anthropic from '@anthropic-ai/sdk';
import { CLASSIFIER_MAX_ATTEMPTS } from '../../shared/constants';
import type { ActivityItem, ClassifiedActivity } from '../../shared/types';
import { buildClassificationPrompt, buildCorrectionMessage, type ClassificationTask } from './prompt';
import { validateClassification } from './schema';

/**
 * One model call. Returns the parsed structured output, or null when the
 * model refused or produced nothing parseable.
 */
export interface ClassifierModel {
  complete(request: { system: string; messages: Anthropic.MessageParam[] }): Promise<unknown>;
}

export class ClassificationError extends Error {
  constructor(
    message: string,
    readonly attempts: number,
    readonly lastErrors: string[],
  ) {
    super(message);
    this.name = 'ClassificationError';
  }
}

export interface ClassifyOptions {
  maxAttempts?: number;
}

/**
 * No output reaches the caller without passing validateClassification.
 * Validation errors are sent back to the model as a follow-up turn, up to
 * maxAttempts calls in total. An empty activity list makes no model call.
 */
export async function classifyActivities(
  model: ClassifierModel,
  task: ClassificationTask,
  activities: ActivityItem[],
  { maxAttempts = CLASSIFIER_MAX_ATTEMPTS }: ClassifyOptions = {},
): Promise<ClassifiedActivity[]> {
  if (activities.length === 0) return [];

  const { system, user } = buildClassificationPrompt(task, activities);
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: user }];
  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // A copy, so later retries don't change what earlier calls were sent.
    const output = await model.complete({ system, messages: [...messages] });
    const result = validateClassification(output, activities);
    if (result.ok) {
      return activities.map((a) => ({ ...a, status: result.statuses.get(a.id)! }));
    }

    lastErrors = result.errors;
    messages.push(
      { role: 'assistant', content: output == null ? '(no answer)' : JSON.stringify(output) },
      { role: 'user', content: buildCorrectionMessage(result.errors) },
    );
  }

  throw new ClassificationError(
    `Claude did not return a valid classification after ${maxAttempts} attempt(s).`,
    maxAttempts,
    lastErrors,
  );
}
