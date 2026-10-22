import assert from "node:assert/strict";
import { test } from "node:test";

import { breakdownByApp, distractionSummary, productivitySplit } from "../background/breakdown.js";

/** A labeled block, as stored on a computer session. */
function block(id, seconds, label, where = {}) {
  return {
    block: { id, start: "2026-10-21T14:00:00Z", seconds, kind: "web", app: "Google Chrome", ...where },
    label: { block_id: id, seconds, label, confidence: 1, reason: "", source: "llm" },
  };
}

function split(items) {
  return { labels: items.map((i) => i.label), blocks: items.map((i) => i.block) };
}

test("time is grouped by site, largest first, with its share of the session", () => {
  const { labels, blocks } = split([
    block("b1", 600, "on_task", { site: "docs.google.com" }),
    block("b2", 300, "off_task", { site: "instagram.com" }),
    block("b3", 900, "on_task", { site: "docs.google.com" }),
  ]);

  assert.deepEqual(breakdownByApp(labels, blocks), [
    { name: "docs.google.com", minutes: 25, pct: 83.33333333333333, label: "on_task" },
    { name: "instagram.com", minutes: 5, pct: 16.666666666666668, label: "off_task" },
  ]);
});

test("desktop apps are named by app and idle time is shown as Idle", () => {
  const { labels, blocks } = split([
    block("b1", 480, "off_task", { kind: "app", app: "Discord", site: null }),
    block("b2", 300, "break", { kind: "idle", app: "", site: null }),
  ]);

  assert.deepEqual(breakdownByApp(labels, blocks).map((a) => a.name), ["Discord", "Idle"]);
});

test("only the top five are listed; the rest are combined into Other", () => {
  const { labels, blocks } = split([
    block("b1", 960, "on_task", { site: "a.com" }),
    block("b2", 600, "on_task", { site: "b.com" }),
    block("b3", 500, "on_task", { site: "c.com" }),
    block("b4", 400, "on_task", { site: "d.com" }),
    block("b5", 300, "on_task", { site: "e.com" }),
    block("b6", 60, "off_task", { site: "f.com" }),
    block("b7", 180, "off_task", { site: "g.com" }),
  ]);

  const rows = breakdownByApp(labels, blocks);

  assert.equal(rows.length, 6);
  assert.deepEqual(rows[5], { name: "Other", minutes: 4, pct: 8, label: "off_task" });
});

test("the session splits into productive, distracting, and other (break or unclear) time", () => {
  const { labels } = split([
    block("b1", 1800, "on_task"),
    block("b2", 600, "off_task"),
    block("b3", 300, "break"),
    block("b4", 300, "unclear"),
  ]);

  assert.deepEqual(productivitySplit(labels), { productive: 60, distracting: 20, other: 20 });
});

test("an empty session splits into zeros instead of dividing by zero", () => {
  assert.deepEqual(productivitySplit([]), { productive: 0, distracting: 0, other: 0 });
});

test("the top distraction is the off-task site with the most time", () => {
  const { labels, blocks } = split([
    block("b1", 600, "on_task", { site: "docs.google.com" }),
    block("b2", 120, "off_task", { site: "instagram.com" }),
    block("b3", 300, "off_task", { site: "tiktok.com" }),
    block("b4", 240, "off_task", { site: "instagram.com" }),
  ]);

  assert.deepEqual(distractionSummary(labels, blocks).top, { name: "instagram.com", minutes: 6 });
});

test("a session with no off-task time has no top distraction", () => {
  const { labels, blocks } = split([block("b1", 600, "on_task", { site: "docs.google.com" })]);

  assert.equal(distractionSummary(labels, blocks).top, null);
});

test("switches count each time on-task work was followed by off-task time", () => {
  const { labels, blocks } = split([
    block("b1", 600, "on_task"),
    block("b2", 60, "off_task"),
    block("b3", 60, "off_task"), // still the same distraction
    block("b4", 600, "on_task"),
    block("b5", 300, "break"),
    block("b6", 60, "off_task"), // a break in between still counts as a switch
    block("b7", 60, "unclear"),
  ]);

  assert.equal(distractionSummary(labels, blocks).switches, 2);
});

test("off-task time at the very start is not a switch away from work", () => {
  const { labels, blocks } = split([block("b1", 60, "off_task"), block("b2", 600, "on_task")]);

  assert.equal(distractionSummary(labels, blocks).switches, 0);
});
