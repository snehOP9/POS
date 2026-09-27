import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../lib/errors.js";
import { assertTableCapacity } from "./tableCapacity.js";

test("table capacity accepts a party that fits", () => {
  assert.doesNotThrow(() => assertTableCapacity(4, 4));
});

test("table capacity rejects an oversized party", () => {
  assert.throws(() => assertTableCapacity(5, 4), (error: unknown) => error instanceof AppError && error.code === "TABLE_CAPACITY_EXCEEDED");
});
test("table capacity rejects invalid guest counts", () => {
  for (const guestCount of [0, -1, 1.5]) {
    assert.throws(() => assertTableCapacity(guestCount, 4), (error: unknown) => error instanceof AppError && error.code === "TABLE_GUEST_COUNT_INVALID");
  }
});