import assert from "node:assert/strict";
import { test } from "node:test";

import { advance } from "../ui/trackerTotals.js";

const totals = (work, idle = 0) => ({ work_seconds: work, idle_seconds: idle });

test("running tasks, groups and the total gain the elapsed seconds as work; stopped ones don't", () => {
  const summary = {
    tasks: [
      { id: "a", running: true, today: totals(60, 5), all: totals(600, 50) },
      { id: "b", running: false, today: totals(30), all: totals(30) },
    ],
    groups: [
      { name: "Chem", running: true, today: totals(60), all: totals(600) },
      { name: "Errands", running: false, today: totals(30), all: totals(30) },
    ],
    total: { running: true, today: totals(90, 5), all: totals(630, 50) },
    activitywatch: true,
  };

  const later = advance(summary, 10);

  assert.deepEqual(later.tasks.map((t) => [t.today, t.all]), [
    [totals(70, 5), totals(610, 50)],
    [totals(30), totals(30)],
  ]);
  assert.deepEqual(later.groups.map((g) => g.today.work_seconds), [70, 30]);
  assert.deepEqual(later.total.all, totals(640, 50));
  assert.equal(summary.tasks[0].today.work_seconds, 60, "the server's summary is left alone");
});
