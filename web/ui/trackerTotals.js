// @ts-check
/**
 * Tasks & groups refresh from the program every 30 seconds; in between, the running session's
 * timer keeps counting on the page. Idle time and stats only change on a refresh.
 */

/**
 * @typedef {{work_seconds: number, idle_seconds: number, sessions: number,
 *            stats: import("./api.js").Stats}} Totals
 * @typedef {{running: boolean, today: Totals, all: Totals, session_ids: string[]}} Counted
 * @typedef {{tasks: (Counted & {id: string, name: string, tags: string[]})[],
 *            groups: (Counted & {name: string})[], total: Counted, activitywatch: boolean}} TrackerSummary
 */

/**
 * The summary as it would be `seconds` after it was fetched. Returns a copy.
 * @param {TrackerSummary} summary @param {number} seconds
 * @returns {TrackerSummary}
 */
export function advance(summary, seconds) {
  /** @template {Counted} T @param {T} item @returns {T} */
  const tick = (item) => item.running
    ? { ...item,
        today: { ...item.today, work_seconds: item.today.work_seconds + seconds },
        all: { ...item.all, work_seconds: item.all.work_seconds + seconds } }
    : item;
  return { ...summary, tasks: summary.tasks.map(tick), groups: summary.groups.map(tick),
           total: tick(summary.total) };
}
