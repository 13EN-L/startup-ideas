// Issue #17: shape Claude must return, and the validator guarding it.
import { z } from 'zod';
import type { ActivityItem, ActivityStatus } from '../../shared/types';

export const ClassificationSchema = z.object({
  classifications: z.array(
    z.object({
      id: z.string(),
      status: z.enum(['on-task', 'off-task']),
    }),
  ),
});

export type ClassificationOutput = z.infer<typeof ClassificationSchema>;

export type ValidationResult =
  | { ok: true; statuses: Map<string, ActivityStatus> }
  | { ok: false; errors: string[] };

/**
 * Checks Claude's output against the activities that were sent: valid shape,
 * every id classified exactly once, and no ids that were not sent.
 */
export function validateClassification(
  output: unknown,
  activities: ActivityItem[],
): ValidationResult {
  if (output === null || output === undefined) {
    return { ok: false, errors: ['No classification was returned.'] };
  }

  const parsed = ClassificationSchema.safeParse(output);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (issue) => `Invalid output at ${issue.path.join('.') || '(root)'}: ${issue.message}`,
      ),
    };
  }

  const expected = new Set(activities.map((a) => a.id));
  const statuses = new Map<string, ActivityStatus>();
  const errors: string[] = [];

  for (const { id, status } of parsed.data.classifications) {
    if (!expected.has(id)) {
      errors.push(`Unknown id (not in the activity list): ${id}`);
    } else if (statuses.has(id)) {
      errors.push(`Duplicate id (classify each activity once): ${id}`);
    } else {
      statuses.set(id, status);
    }
  }
  for (const id of expected) {
    if (!statuses.has(id)) errors.push(`Missing id: ${id}`);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, statuses };
}
