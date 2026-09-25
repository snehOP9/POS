import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../lib/errors.js";
import type { ActorContext } from "./order.service.js";
import { assertShiftPermission } from "./shift.service.js";

const cashier: ActorContext = { accountId: "cashier", restaurantId: "restaurant", role: "CASHIER", permissions: ["canOpenShift", "canCloseShift"], tokenVersion: 0 };

test("cashier with shift permissions can operate a register", () => {
  assert.doesNotThrow(() => assertShiftPermission(cashier, "canOpenShift"));
  assert.doesNotThrow(() => assertShiftPermission(cashier, "canCloseShift"));
});

test("staff without the matching shift permission cannot operate a register", () => {
  const waiter: ActorContext = { accountId: "waiter", restaurantId: "restaurant", role: "WAITER", permissions: [], tokenVersion: 0 };
  assert.throws(
    () => assertShiftPermission(waiter, "canOpenShift"),
    (error: unknown) => error instanceof AppError && error.code === "AUTH_MISSING_PERMISSION"
  );
});