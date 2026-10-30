// @ts-check
/**
 * Where a computer session's time went, computed by code from the final labels and the
 * blocks they belong to. Recomputed whenever a session is shown, so review decisions count.
 */

/**
 * @typedef {{name: string, minutes: number, pct: number, label: string}} AppTime
 */

const TOP_APPS = 5;

/**
 * Minutes per site (web) or app, largest first. Past the top five, the rest become "Other".
 * Each row's label is the label that covered most of its time.
 * @param {import("./api.js").FinalLabel[]} labels
 * @param {any[]} blocks
 * @returns {AppTime[]}
 */
export function breakdownByApp(labels, blocks) {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  /** @type {Map<string, Record<string, number>>} seconds per label, per name */
  const groups = new Map();
  let total = 0;
  for (const item of labels) {
    const name = nameOf(byId.get(item.block_id));
    const byLabel = groups.get(name) || {};
    addSeconds(byLabel, item.label, item.seconds);
    groups.set(name, byLabel);
    total += item.seconds;
  }
  const sorted = [...groups].sort((a, b) => sum(b[1]) - sum(a[1]));
  if (sorted.length > TOP_APPS) {
    /** @type {Record<string, number>} */
    const other = {};
    for (const [, byLabel] of sorted.splice(TOP_APPS)) {
      for (const [label, seconds] of Object.entries(byLabel)) addSeconds(other, label, seconds);
    }
    sorted.push(["Other", other]);
  }
  return sorted.map(([name, byLabel]) => ({
    name,
    minutes: sum(byLabel) / 60,
    pct: total ? (100 * sum(byLabel)) / total : 0,
    label: mainLabel(byLabel),
  }));
}

/**
 * Percent of the session that was productive (on_task), distracting (off_task), or
 * other (break or unclear). The three add up to 100, or are all 0 for an empty session.
 * @param {import("./api.js").FinalLabel[]} labels
 * @returns {{productive: number, distracting: number, other: number}}
 */
export function productivitySplit(labels) {
  /** @type {Record<string, number>} */
  const byLabel = {};
  for (const item of labels) addSeconds(byLabel, item.label, item.seconds);
  const total = sum(byLabel);
  const pct = (/** @type {number} */ seconds) => (total ? (100 * seconds) / total : 0);
  const productive = byLabel.on_task || 0;
  const distracting = byLabel.off_task || 0;
  return { productive: pct(productive), distracting: pct(distracting),
           other: pct(total - productive - distracting) };
}

/**
 * The off-task site or app that took the most time (null if nothing was off-task), and how
 * many times on-task work was followed by off-task time. Labels must be in time order;
 * break and unclear blocks between the two don't break up a switch.
 * @param {import("./api.js").FinalLabel[]} labels
 * @param {any[]} blocks
 * @returns {{top: {name: string, minutes: number}|null, switches: number}}
 */
export function distractionSummary(labels, blocks) {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  /** @type {Record<string, number>} off-task seconds per name */
  const offTask = {};
  let switches = 0;
  let last = "";
  for (const item of labels) {
    if (item.label === "off_task") {
      addSeconds(offTask, nameOf(byId.get(item.block_id)), item.seconds);
      if (last === "on_task") switches += 1;
    }
    if (item.label === "on_task" || item.label === "off_task") last = item.label;
  }
  const [worst] = Object.entries(offTask).sort((a, b) => b[1] - a[1]);
  return { top: worst ? { name: worst[0], minutes: worst[1] / 60 } : null, switches };
}

/**
 * The productivity split from stats the program combined over several sessions
 * (paper sessions included), in the same shape as productivitySplit.
 * @param {import("./api.js").Stats} stats
 */
export function splitFromStats(stats) {
  const total = stats.total_minutes;
  const pct = (/** @type {number} */ minutes) => (total ? (100 * minutes) / total : 0);
  const productive = pct(stats.on_task_minutes);
  const distracting = pct(stats.off_task_minutes);
  return { productive, distracting, other: total ? 100 - productive - distracting : 0 };
}

/**
 * Time by site or app and the biggest distraction over several saved sessions (a task or a
 * group). Only computer sessions have blocks; off-task switches are counted per session.
 * @param {any[]} sessions saved sessions, oldest first
 */
export function combinedBreakdown(sessions) {
  /** @type {import("./api.js").FinalLabel[]} */
  const labels = [];
  /** @type {any[]} */
  const blocks = [];
  let switches = 0;
  for (const session of sessions) {
    if (session.kind !== "computer") continue;
    const own = session.blocks || [];
    switches += distractionSummary(session.result.labels, own).switches;
    // Block ids (b1, b2, ...) repeat across sessions, so they're made unique here.
    labels.push(...session.result.labels.map(
      (/** @type {any} */ l) => ({ ...l, block_id: `${session.id}/${l.block_id}` })));
    blocks.push(...own.map((/** @type {any} */ b) => ({ ...b, id: `${session.id}/${b.id}` })));
  }
  return { apps: breakdownByApp(labels, blocks),
           distraction: { top: distractionSummary(labels, blocks).top, switches } };
}

/** @param {Record<string, number>} byLabel @param {string} label @param {number} seconds */
function addSeconds(byLabel, label, seconds) {
  byLabel[label] = (byLabel[label] || 0) + seconds;
}

/** @param {Record<string, number>} byLabel */
const sum = (byLabel) => Object.values(byLabel).reduce((a, b) => a + b, 0);

/** @param {any} block */
function nameOf(block) {
  if (block?.kind === "idle") return "Idle";
  return block?.site || block?.app || "Unknown";
}

/** The label with the most seconds. @param {Record<string, number>} byLabel */
function mainLabel(byLabel) {
  return Object.entries(byLabel).sort((a, b) => b[1] - a[1])[0][0];
}
