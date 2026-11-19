// Issue #17: metrics computed from Claude's on-task / off-task classification
import { describe, expect, it } from 'vitest';
import { computeMetrics, productiveMinutes } from '../../src/core/metrics';
import { makeActivity } from '../fixtures';

describe('#17 computeMetrics', () => {
  it('sums on-task time as productive and off-task time as unproductive', () => {
    const metrics = computeMetrics(
      [
        makeActivity({ name: 'Code', source: 'app', seconds: 900, status: 'on-task' }),
        makeActivity({ name: 'docs.python.org', seconds: 300, status: 'on-task' }),
        makeActivity({ name: 'reddit.com', seconds: 240, status: 'off-task' }),
      ],
      120,
    );
    expect(metrics).toEqual({ productiveSeconds: 1200, unproductiveSeconds: 240, idleSeconds: 120 });
  });

  it('handles a task with no activity', () => {
    expect(computeMetrics([], 0)).toEqual({ productiveSeconds: 0, unproductiveSeconds: 0, idleSeconds: 0 });
  });

  it('rejects negative idle time', () => {
    expect(() => computeMetrics([], -5)).toThrow(RangeError);
  });
});

describe('#17 productiveMinutes', () => {
  it('converts productive seconds to (fractional) minutes for plant growth', () => {
    expect(productiveMinutes({ productiveSeconds: 450, unproductiveSeconds: 60, idleSeconds: 60 })).toBe(7.5);
  });
});
