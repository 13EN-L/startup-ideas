// @ts-check
/**
 * The time tracker refreshes from the program every 30 seconds; in between, running timers
 * keep counting on the page. Idle time only changes on a refresh (ActivityWatch decides it).
 */

/**
 * @typedef {{work_seconds: number, idle_seconds: number}} Totals
 * @typedef {{running: boolean, today: Totals, all: Totals}} Counted
 * @typedef {{tasks: (Counted & {id: string, name: string, tags: string[], done: boolean})[],
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
