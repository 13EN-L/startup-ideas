// @ts-check
/**
 * Elements for productivity breakdowns, shared by a session's result (app.js) and the
 * Tasks & groups section (tracker.js). Site and app names are untrusted, so text only.
 */

import { formatMinutes, h } from "./dom.js";

export const LABEL_NAMES = { on_task: "On task", off_task: "Off task", break: "Break", unclear: "Unclear" };

/**
 * The productive / distracting / other bar and its legend.
 * @param {{productive: number, distracting: number, other: number}} split
 */
export function splitView(split) {
  const parts = /** @type {const} */ ([
    ["productive", "productive"], ["distracting", "distracting"], ["other", "break or unclear"],
  ]);
  const bar = h("div", { class: "split-bar", "aria-hidden": "true" }, ...parts.map(([key]) => {
    const seg = h("span", { class: `seg seg-${key}` });
    seg.style.width = `${split[key]}%`;
    return seg;
  }));
  const legend = h("ul", { class: "split-legend" }, ...parts.map(([key, caption]) =>
    h("li", {}, h("span", { class: `dot dot-${key}` }), h("strong", {}, `${Math.round(split[key])}%`),
      caption)));
  return [bar, legend];
}

/**
 * "Biggest distraction: x (5 min) · switched off-task 3 times", or "" if nothing was off-task.
 * @param {{top: {name: string, minutes: number}|null, switches: number}} summary
 */
export function distractionText({ top, switches }) {
  const parts = [];
  if (top) parts.push(`Biggest distraction: ${top.name} (${formatMinutes(top.minutes)})`);
  if (switches) parts.push(`switched off-task ${switches === 1 ? "once" : `${switches} times`}`);
  return parts.join(" · ");
}

/** Rows of time by site or app. @param {import("./breakdown.js").AppTime[]} apps */
export function appRows(apps) {
  return apps.map((app) => {
    const bar = h("span", { class: `app-bar-${app.label}` });
    bar.style.width = `${app.pct}%`;
    return h("li", { class: "app" },
      h("span", { class: "app-name", title: app.name }, app.name),
      h("span", { class: "app-time" },
        `${formatMinutes(app.minutes)} · ${Math.round(app.pct)}% · ${LABEL_NAMES[app.label] || app.label}`),
      h("div", { class: "app-track" }, bar));
  });
}
