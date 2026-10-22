// @ts-check
/**
 * Recomputes stats after the user resolves a block on the review screen.
 * Mirrors backend/app/stats.py exactly; keep the two in sync.
 */

/**
 * @param {import("./backendClient.js").FinalLabel[]} labels in time order
 * @returns {import("./backendClient.js").Stats}
 */
export function computeStats(labels) {
  /** @type {Record<string, number>} */
  const seconds = { on_task: 0, off_task: 0, break: 0, unclear: 0 };
  let longest = 0;
  let streak = 0;
  for (const item of labels) {
    seconds[item.label] += item.seconds;
    streak = item.label === "on_task" ? streak + item.seconds : 0;
    longest = Math.max(longest, streak);
  }
  const total = seconds.on_task + seconds.off_task + seconds.break + seconds.unclear;
  return {
    total_minutes: total / 60,
    on_task_minutes: seconds.on_task / 60,
    off_task_minutes: seconds.off_task / 60,
    break_minutes: seconds.break / 60,
    unclear_minutes: seconds.unclear / 60,
    on_task_pct: total ? (100 * seconds.on_task) / total : 0,
    longest_streak_minutes: longest / 60,
  };
}
