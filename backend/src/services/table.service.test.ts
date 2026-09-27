import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../lib/errors.js";
import { assertTableAssignment } from "./table.service.js";

const waiter = { accountId: "waiter-a", restaurantId: "restaurant", role: "WAITER" as const, permissions: [], tokenVersion: 0 };

test("waiter table assignment allows the assigned waiter", () => {
  assert.doesNotThrow(() => assertTableAssignment(waiter, { toString: () => "waiter-a" }));
});

test("waiter table assignment rejects another waiter", () => {
  assert.throws(
    () => assertTableAssignment(waiter, { toString: () => "waiter-b" }),
    (error: unknown) => error instanceof AppError && error.code === "TABLE_NOT_ASSIGNED"
  );
});