// Issue #17: classify activities with a validate-and-retry loop.
import type Anthropic from '@anthropic-ai/sdk';
import { CLASSIFIER_MAX_ATTEMPTS } from '../../shared/constants';
import { notImplemented } from '../../shared/notImplemented';
import type { ActivityItem, ClassifiedActivity } from '../../shared/types';
import type { ClassificationTask } from './prompt';

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
  return notImplemented(
    `classifyActivities(${typeof model}, ${task.name}, ${activities.length}, ${maxAttempts})`,
  );
}
