import assert from "node:assert/strict";
import test from "node:test";

import { canTransitionItem, canTransitionOrder } from "./orderTransitions.js";

test("order transitions reject lifecycle skips", () => {
  assert.equal(canTransitionOrder("PLACED", "READY"), false);
  assert.equal(canTransitionOrder("PLACED", "CONFIRMED"), true);
});

test("item transitions require preparation before readiness", () => {
  assert.equal(canTransitionItem("PENDING", "READY"), false);
  assert.equal(canTransitionItem("PREPARING", "READY"), true);
});
