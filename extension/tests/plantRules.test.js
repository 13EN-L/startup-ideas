import assert from "node:assert/strict";
import { test } from "node:test";

import { plantFor } from "../background/plantRules.js";

const fern = { name: "Fern", gif: "plants/fern.gif", minutesToFullGrowth: 60 };

test("a half-grown plant reports 50% and the on-task minutes still needed", () => {
  const plant = plantFor(fern, 30);

  assert.equal(plant.percent, 50);
  assert.equal(plant.minutesLeft, 30);
});

test("growth is never shown as 100% until the plant is actually fully grown", () => {
  assert.equal(plantFor(fern, 59.8).percent, 99);
});

test("extra on-task time caps growth at 100% with nothing left to go", () => {
  const plant = plantFor(fern, 90);

  assert.equal(plant.percent, 100);
  assert.equal(plant.minutesLeft, 0);
});
