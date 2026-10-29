// @ts-check
/**
 * The Time tracker tab: task timers that run alongside focus sessions. The program computes
 * every total (overlap-free per group, idle from ActivityWatch; backend/app/tracker.py);
 * this file only renders, and keeps running timers counting between refreshes.
 */

import { api } from "./api.js";
import { $, formatElapsed, formatMinutes, h } from "./dom.js";
import { advance } from "./trackerTotals.js";

const REFRESH_MS = 30_000;

/** @type {import("./trackerTotals.js").TrackerSummary|null} */
let summary = null;
let fetchedAt = 0;
let refreshTimer = 0;
let tickTimer = 0;
/** While a task is being edited, refreshes wait so the form isn't replaced. */
let editingId = "";
/** @type {(err: unknown) => void} */
let showError = () => {};
/** Elements whose text shows a ticking total, refreshed every second. @type {(() => void)[]} */
let tickers = [];

/** @param {(err: unknown) => void} onError */
export function showTracker(onError) {
  showError = onError;
  stopTracker();
  refresh();
  refreshTimer = setInterval(() => { if (!editingId) refresh(); }, REFRESH_MS);
  tickTimer = setInterval(tick, 1000);
}

export function stopTracker() {
  clearInterval(refreshTimer);
  clearInterval(tickTimer);
}

/** Midnight in the user's own time zone; "today" totals start here. */
function localMidnight() {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  return day.toISOString();
}

async function refresh() {
  try {
    summary = await api.getTracker(localMidnight());
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
  editingId = "";
  await refresh();
}

/** The summary as of now, counting running timers since it was fetched. */
const current = () => advance(/** @type {any} */ (summary), (Date.now() - fetchedAt) / 1000);

function tick() {
  if (summary) for (const update of tickers) update();
}

/** @param {number} seconds */
const work = (seconds) => formatElapsed(seconds * 1000);
/** @param {number} seconds */
const idle = (seconds) => formatMinutes(seconds / 60);

/**
 * Lines like "Today 0:42:10 work · 3 min idle". They keep themselves up to date.
 * @param {(s: import("./trackerTotals.js").TrackerSummary) => any} pick the item in the summary
 */
function totalsLine(pick) {
  const today = h("span", { class: "block-meta" });
  const all = h("span", { class: "block-meta" });
  const update = () => {
    const item = pick(current());
    if (!item) return;
    today.textContent = `Today ${work(item.today.work_seconds)} work · ${idle(item.today.idle_seconds)} idle`;
    all.textContent = `All time ${work(item.all.work_seconds)} work · ${idle(item.all.idle_seconds)} idle`;
  };
  tickers.push(update);
  update();
  return h("div", { class: "stack-tight" }, today, all);
}

/** @param {string} value @param {string} caption */
function tile(value, caption) {
  const number = h("div", { class: "stat" }, value);
  return { number, el: h("div", {}, number, h("span", { class: "stat-label" }, caption)) };
}

function render() {
  if (!summary) return;
  tickers = [];
  $("tracker-aw-warning").hidden = summary.activitywatch;

  const todayWork = tile("", "work");
  const todayIdle = tile("", "idle");
  const allWork = tile("", "work, all time");
  tickers.push(() => {
    const { total } = current();
    todayWork.number.textContent = work(total.today.work_seconds);
    todayIdle.number.textContent = idle(total.today.idle_seconds);
    allWork.number.textContent = work(total.all.work_seconds);
  });
  $("tracker-total").replaceChildren(todayWork.el, todayIdle.el, allWork.el);

  $("tracker-groups-box").hidden = summary.groups.length === 0;
  $("tracker-groups").replaceChildren(...summary.groups.map((group) => h("li", { class: "block" },
    h("div", { class: "block-head" },
      h("span", { class: "block-title" }, group.name),
      ...(group.running ? [h("span", { class: "chip chip-on_task" }, "Running")] : [])),
    totalsLine((s) => s.groups.find((g) => g.name === group.name)))));

  const open = summary.tasks.filter((t) => !t.done);
  const done = summary.tasks.filter((t) => t.done);
  $("tracker-empty").hidden = open.length > 0;
  $("tracker-tasks").replaceChildren(...open.map(taskItem));
  $("tracker-done-box").hidden = done.length === 0;
  $("tracker-done").replaceChildren(...done.map(taskItem));
  tick();
}

/** @param {string} label @param {() => void} onClick @param {string} [kind] */
function button(label, onClick, kind = "btn btn-secondary") {
  const el = h("button", { type: "button", class: kind }, label);
  el.addEventListener("click", onClick);
  return el;
}

/** @param {import("./trackerTotals.js").TrackerSummary["tasks"][number]} task */
function taskItem(task) {
  if (task.id === editingId) return editItem(task);
  const actions = h("div", { class: "review-actions" });
  if (!task.done) {
    actions.append(task.running
      ? button("Stop", () => act(() => api.stopTask(task.id)))
      : button("Start", () => act(() => api.startTask(task.id)), "btn"));
    actions.append(button("Edit", () => { editingId = task.id; render(); }));
    actions.append(button("Done", () => act(() => api.editTask(task.id, { done: true }))));
  } else {
    actions.append(button("Reopen", () => act(() => api.editTask(task.id, { done: false }))));
  }
  actions.append(button("Delete", () => {
    if (confirm(`Delete "${task.name}" and its tracked time?`)) act(() => api.deleteTask(task.id));
  }));
  return h("li", { class: "block" },
    h("div", { class: "block-head" },
      h("span", { class: "block-title" }, task.name),
      ...(task.running ? [h("span", { class: "chip chip-on_task" }, "Running")] : [])),
    ...(task.tags.length
      ? [h("div", { class: "tags" }, ...task.tags.map((tag) => h("span", { class: "chip chip-tag" }, tag)))]
      : []),
    totalsLine((s) => s.tasks.find((t) => t.id === task.id)),
    actions);
}

/** @param {import("./trackerTotals.js").TrackerSummary["tasks"][number]} task */
function editItem(task) {
  const name = /** @type {HTMLInputElement} */ (h("input", { class: "input", maxlength: "200",
    "aria-label": "Task name" }));
  name.value = task.name;
  const tags = /** @type {HTMLInputElement} */ (h("input", { class: "input",
    placeholder: "Groups, separated by commas", "aria-label": "Groups" }));
  tags.value = task.tags.join(", ");
  return h("li", { class: "block" }, name, tags, h("div", { class: "review-actions" },
    button("Save", () => {
      if (!name.value.trim()) return;
      act(() => api.editTask(task.id, { name: name.value.trim(), tags: splitList(tags.value) }));
    }, "btn"),
    button("Cancel", () => { editingId = ""; render(); })));
}

/** @param {string} value */
const splitList = (value) => value.split(",").map((s) => s.trim()).filter(Boolean);

$("tracker-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = /** @type {HTMLInputElement} */ ($("tracker-name"));
  const tags = /** @type {HTMLInputElement} */ ($("tracker-tags"));
  if (!name.value.trim()) return;
  const task = { name: name.value.trim(), tags: splitList(tags.value) };
  name.value = "";
  act(() => api.addTask(task));
});
