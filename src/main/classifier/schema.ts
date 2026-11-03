// Issue #17: shape Claude must return, and the validator guarding it.
import { z } from 'zod';
import { notImplemented } from '../../shared/notImplemented';
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
  return notImplemented(`validateClassification(${typeof output}, ${activities.length})`);
}
