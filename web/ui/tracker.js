// @ts-check
/**
 * The Tasks & groups section, under the focus session. Tasks are only created by starting a
 * session (named on the Focus form); here the user puts them in groups and sees, per task,
 * group and in total, the productivity stats from their sessions' labels and the time
 * tracked. The program computes every total (backend/app/tracker.py); this file only
 * renders, and keeps the running session's timer counting between refreshes.
 */

import { api } from "./api.js";
import { combinedBreakdown, splitFromStats } from "./breakdown.js";
import { appRows, distractionText, splitView } from "./breakdownView.js";
import { $, formatElapsed, formatMinutes, h } from "./dom.js";
import { advance } from "./trackerTotals.js";

const REFRESH_MS = 30_000;

/** @type {import("./trackerTotals.js").TrackerSummary|null} */
let summary = null;
/** Saved sessions by id, for the site/app breakdowns. @type {Map<string, any>} */
let sessionsById = new Map();
let fetchedAt = 0;
/** @type {(err: unknown) => void} */
let showError = () => {};
/** Elements whose text shows a ticking total, refreshed every second. @type {(() => void)[]} */
let tickers = [];
/** Breakdowns the user opened, kept open across refreshes ("total", "group:x", "task:id"). */
const openDetails = new Set();

/** Starts showing the section; it refreshes itself from then on. @param {(err: unknown) => void} onError */
export function showTracker(onError) {
  showError = onError;
  refreshTracker();
  // While the user is typing a group name, refreshes wait so the input isn't replaced.
  setInterval(() => { if (!$("tracker-pane").contains(document.activeElement)) refreshTracker(); },
    REFRESH_MS);
  setInterval(tick, 1000);
}

/** Midnight in the user's own time zone; "today" totals start here. */
function localMidnight() {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  return day.toISOString();
}

/** Reloads totals, e.g. after a session starts, ends or is reviewed. */
export async function refreshTracker() {
  try {
    const [next, history] = await Promise.all([api.getTracker(localMidnight()), api.getHistory()]);
    summary = next;
    sessionsById = new Map(/** @type {any[]} */ (history).map((s) => [s.id, s]));
    fetchedAt = Date.now();
    render();
  } catch (err) {
    showError(err);
  }
}

/** Runs a change, then shows the result. @param {() => Promise<unknown>} change */
async function act(change) {
  showError(null);
  try {
    await change();
  } catch (err) {
    showError(err);
  }
  await refreshTracker();
}

/** The summary as of now, counting running timers since it was fetched. */
const current = () => advance(/** @type {any} */ (summary), (Date.now() - fetchedAt) / 1000);

function tick() {
  if (summary) for (const update of tickers) update();
}

/** @param {import("./trackerTotals.js").Totals} period */
function periodText(period) {
  const tracked = `${formatElapsed(period.work_seconds * 1000)} tracked`
    + (period.idle_seconds ? ` · ${formatMinutes(period.idle_seconds / 60)} idle` : "");
  if (!period.sessions) return tracked;
  const { stats } = period;
  const sessions = period.sessions === 1 ? "1 session" : `${period.sessions} sessions`;
  return [`${formatMinutes(stats.on_task_minutes)} on task (${Math.round(stats.on_task_pct)}%)`,
    `longest focus ${formatMinutes(stats.longest_streak_minutes)}`, sessions, tracked].join(" · ");
}

/**
 * Lines like "Today: 42 min on task (81%) · longest focus 25 min · 2 sessions · 0:52:10 tracked".
 * They keep themselves up to date.
 * @param {(s: import("./trackerTotals.js").TrackerSummary) => any} pick the item in the summary
 */
function totalsLines(pick) {
  const today = h("span", { class: "block-meta" });
  const all = h("span", { class: "block-meta" });
  const update = () => {
    const item = pick(current());
    if (!item) return;
    today.textContent = `Today: ${periodText(item.today)}`;
    all.textContent = `All time: ${periodText(item.all)}`;
  };
  tickers.push(update);
  update();
  return h("div", { class: "stack-tight" }, today, all);
}

/**
 * All-time breakdown, like a session's result: productive / distracting split, biggest
 * distraction and time by site or app. Built when first opened.
 * @param {string} key @param {{all: import("./trackerTotals.js").Totals, session_ids: string[]}} item
 */
function breakdown(key, item) {
  if (!item.all.sessions) return [];
  const details = h("details", { class: "breakdown" }, h("summary", { class: "muted" }, "Breakdown, all time"));
  const fill = () => {
    if (details.childElementCount > 1) return;
    const sessions = item.session_ids.map((id) => sessionsById.get(id)).filter(Boolean);
    const { apps, distraction } = combinedBreakdown(sessions);
    const text = distractionText(distraction);
    details.append(h("div", { class: "split" }, ...splitView(splitFromStats(item.all.stats))),
      ...(text ? [h("p", { class: "muted small" }, text)] : []),
      ...(apps.length ? [h("ul", { class: "apps" }, ...appRows(apps))] : []));
  };
  details.addEventListener("toggle", () => {
    if (details.open) { openDetails.add(key); fill(); } else openDetails.delete(key);
  });
  if (openDetails.has(key)) { details.open = true; fill(); }
  return [details];
}

/** @param {string} value @param {string} caption */
function tile(value, caption) {
  return h("div", {}, h("div", { class: "stat" }, value), h("span", { class: "stat-label" }, caption));
}

/** @param {boolean} running */
const runningChip = (running) => running ? [h("span", { class: "chip chip-on_task" }, "Running")] : [];

function render() {
  if (!summary) return;
  tickers = [];
  $("tracker-aw-warning").hidden = summary.activitywatch;

  const { stats } = summary.total.today;
  $("tracker-total").replaceChildren(
    tile(formatMinutes(stats.on_task_minutes), "on task"),
    tile(`${Math.round(stats.on_task_pct)}%`, "of your time"),
    tile(formatMinutes(stats.longest_streak_minutes), "longest focus"));
  $("tracker-total-lines").replaceChildren(totalsLines((s) => s.total), ...breakdown("total", summary.total));

  const groupNames = summary.groups.map((g) => g.name);
  $("tracker-group-names").replaceChildren(...groupNames.map((name) => h("option", { value: name })));
  $("tracker-groups-box").hidden = summary.groups.length === 0;
  $("tracker-groups").replaceChildren(...summary.groups.map((group) => h("li", { class: "block" },
    h("div", { class: "block-head" },
      h("span", { class: "block-title" }, group.name), ...runningChip(group.running)),
    totalsLines((s) => s.groups.find((g) => g.name === group.name)),
    ...breakdown(`group:${group.name.toLowerCase()}`, group))));

  $("tracker-empty").hidden = summary.tasks.length > 0;
  $("tracker-tasks").replaceChildren(...summary.tasks.map(taskItem));
  tick();
}

/** @param {string} label @param {() => void} onClick @param {string} [kind] */
function button(label, onClick, kind = "btn btn-secondary") {
  const el = h("button", { type: "button", class: kind }, label);
  el.addEventListener("click", onClick);
  return el;
}

/** @param {string} value */
const splitList = (value) => value.split(",").map((s) => s.trim()).filter(Boolean);

/** @param {string} id @param {string[]} tags */
const setGroups = (id, tags) => act(() => api.editTask(id, { tags }));

/**
 * The task's groups as chips with a remove button, and an input to add it to a group.
 * @param {import("./trackerTotals.js").TrackerSummary["tasks"][number]} task
 */
function groupEditor(task) {
  const chips = task.tags.map((tag) => {
    const remove = h("button", { type: "button", class: "chip-remove", "aria-label": `Remove from ${tag}` }, "×");
    remove.addEventListener("click", () => setGroups(task.id, task.tags.filter((t) => t !== tag)));
    return h("span", { class: "chip chip-tag" }, tag, remove);
  });
  const input = /** @type {HTMLInputElement} */ (h("input", { class: "input input-small",
    list: "tracker-group-names", placeholder: task.tags.length ? "Add another group" : "Add to a group",
    "aria-label": `Add ${task.name} to a group`, maxlength: "100" }));
  const add = () => {
    const added = splitList(input.value);
    if (added.length) setGroups(task.id, [...task.tags, ...added]);
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); add(); }
  });
  return h("div", { class: "tags" }, ...chips,
    h("span", { class: "add-group" }, input, button("Add", add)));
}

/** @param {import("./trackerTotals.js").TrackerSummary["tasks"][number]} task */
function taskItem(task) {
  // Sessions are ended with their own Done button above; a task has no Done of its own.
  const actions = h("div", { class: "review-actions" }, button("Delete", () => {
    if (confirm(`Delete "${task.name}" and its tracked time? Its sessions stay in your history.`)) {
      act(() => api.deleteTask(task.id));
    }
  }));
  return h("li", { class: "block" },
    h("div", { class: "block-head" },
      h("span", { class: "block-title" }, task.name), ...runningChip(task.running)),
    groupEditor(task),
    totalsLines((s) => s.tasks.find((t) => t.id === task.id)),
    ...breakdown(`task:${task.id}`, task),
    actions);
}
