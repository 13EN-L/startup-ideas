// Issue #17: the validation guardrail and retry loop hold for any activity log
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { computeMetrics } from '../../src/core/metrics';
import { ClassificationError, classifyActivities } from '../../src/main/classifier/classify';
import { buildClassificationPrompt } from '../../src/main/classifier/prompt';
import { validateClassification } from '../../src/main/classifier/schema';
import type { ActivityItem, ActivityStatus } from '../../src/shared/types';
import { activityListArb, categoryArb, classifiedActivityArb, taskNameArb } from './arbitraries';

const statusArb = fc.constantFrom<ActivityStatus>('on-task', 'off-task');

/** Activities plus a correct, shuffled classification for them. */
const classifiedLogArb = activityListArb()
  .filter((a) => a.length > 0)
  .chain((activities) =>
    fc
      .array(statusArb, { minLength: activities.length, maxLength: activities.length })
      .chain((statuses) =>
        fc.shuffledSubarray(
          activities.map((a, i) => ({ id: a.id, status: statuses[i] })),
          { minLength: activities.length, maxLength: activities.length },
        ).map((classifications) => ({ activities, classifications })),
      ),
  );

describe('#17 validateClassification properties', () => {
  it('accepts any complete classification, in any order, and keeps each status', () => {
    fc.assert(
      fc.property(classifiedLogArb, ({ activities, classifications }) => {
        const result = validateClassification({ classifications }, activities);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.statuses.size).toBe(activities.length);
          for (const c of classifications) expect(result.statuses.get(c.id)).toBe(c.status);
        }
      }),
    );
  });

  it('rejects a classification missing any one activity and names it', () => {
    fc.assert(
      fc.property(classifiedLogArb, fc.nat(), ({ activities, classifications }, pick) => {
        const dropped = classifications[pick % classifications.length];
        const result = validateClassification(
          { classifications: classifications.filter((c) => c !== dropped) },
          activities,
        );
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.errors.join('\n')).toContain(dropped.id);
      }),
    );
  });

  it('rejects any id that was never sent', () => {
    fc.assert(
      fc.property(classifiedLogArb, fc.string({ minLength: 1 }), statusArb, ({ activities, classifications }, extra, status) => {
        const id = `web:${extra}`;
        fc.pre(!activities.some((a) => a.id === id));
        const result = validateClassification({ classifications: [...classifications, { id, status }] }, activities);
        expect(result.ok).toBe(false);
      }),
    );
  });

  it('rejects any duplicated id', () => {
    fc.assert(
      fc.property(classifiedLogArb, fc.nat(), statusArb, ({ activities, classifications }, pick, status) => {
        const dup = { id: classifications[pick % classifications.length].id, status };
        expect(validateClassification({ classifications: [...classifications, dup] }, activities).ok).toBe(false);
      }),
    );
  });

  it('never throws, whatever the model returns', () => {
    fc.assert(
      fc.property(fc.anything(), activityListArb(5), (output, activities) => {
        expect(() => validateClassification(output, activities)).not.toThrow();
      }),
    );
  });
});

describe('#17 buildClassificationPrompt properties', () => {
  it('includes every activity id, whatever the names contain', () => {
    fc.assert(
      fc.property(taskNameArb, categoryArb, activityListArb(), (name, category, activities) => {
        const { user } = buildClassificationPrompt({ name, category }, activities);
        for (const a of activities) expect(user).toContain(a.id);
      }),
    );
  });

  it('keeps the system prompt identical for every input (cacheable prefix)', () => {
    const reference = buildClassificationPrompt({ name: 'x', category: 'work' }, []).system;
    fc.assert(
      fc.property(taskNameArb, categoryArb, activityListArb(), (name, category, activities) => {
        expect(buildClassificationPrompt({ name, category }, activities).system).toBe(reference);
      }),
    );
  });
});

describe('#17 classifyActivities retry properties', () => {
  const task = { name: 'Study', category: 'school' as const };

  it('succeeds after k invalid answers when k < maxAttempts, using exactly k + 1 calls', async () => {
    await fc.assert(
      fc.asyncProperty(classifiedLogArb, fc.integer({ min: 1, max: 5 }), fc.nat(), async (log, maxAttempts, k0) => {
        const k = k0 % maxAttempts;
        const complete = vi.fn();
        for (let i = 0; i < k; i++) complete.mockResolvedValueOnce(null);
        complete.mockResolvedValueOnce({ classifications: log.classifications });

        const result = await classifyActivities({ complete }, task, log.activities, { maxAttempts });
        expect(complete).toHaveBeenCalledTimes(k + 1);
        expect(result.map((a) => a.id)).toEqual(log.activities.map((a: ActivityItem) => a.id));
      }),
    );
  });

  it('gives up with ClassificationError after exactly maxAttempts invalid answers', async () => {
    await fc.assert(
      fc.asyncProperty(classifiedLogArb, fc.integer({ min: 1, max: 5 }), async (log, maxAttempts) => {
        const complete = vi.fn().mockResolvedValue({ classifications: [] });
        const error = await classifyActivities({ complete }, task, log.activities, { maxAttempts }).catch((e) => e);
        expect(error).toBeInstanceOf(ClassificationError);
        expect(complete).toHaveBeenCalledTimes(maxAttempts);
      }),
    );
  });
});

describe('#17 computeMetrics properties', () => {
  it('splits all classified time into productive and unproductive, ignoring order', () => {
    fc.assert(
      fc.property(fc.array(classifiedActivityArb, { maxLength: 20 }), fc.nat(36_000), (activities, idle) => {
        const m = computeMetrics(activities, idle);
        const total = activities.reduce((s, a) => s + a.seconds, 0);
        expect(m.productiveSeconds + m.unproductiveSeconds).toBe(total);
        expect(m.idleSeconds).toBe(idle);
        expect(computeMetrics([...activities].reverse(), idle)).toEqual(m);
      }),
    );
  });
});
