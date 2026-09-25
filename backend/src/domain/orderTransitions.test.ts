import assert from "node:assert/strict";
import test from "node:test";

import { canTransitionItem, canTransitionOrder, roleMaySetItemStatus, roleMaySetOrderStatus } from "./orderTransitions.js";

test("order transitions reject lifecycle skips", () => {
  assert.equal(canTransitionOrder("PLACED", "READY"), false);
  assert.equal(canTransitionOrder("PLACED", "CONFIRMED"), true);
});

test("item transitions require preparation before readiness", () => {
  assert.equal(canTransitionItem("PENDING", "READY"), false);
  assert.equal(canTransitionItem("PREPARING", "READY"), true);
});

test("order status changes stay within their role boundary", () => {
  assert.equal(roleMaySetOrderStatus("CUSTOMER", "PLACED"), true);
  assert.equal(roleMaySetOrderStatus("CUSTOMER", "READY"), false);
  assert.equal(roleMaySetOrderStatus("WAITER", "SERVED"), true);
  assert.equal(roleMaySetOrderStatus("WAITER", "COMPLETED"), false);
  assert.equal(roleMaySetOrderStatus("KITCHEN", "PREPARING"), true);
  assert.equal(roleMaySetOrderStatus("KITCHEN", "CONFIRMED"), false);
  assert.equal(roleMaySetOrderStatus("CASHIER", "COMPLETED"), true);
});

test("item status changes keep kitchen, service, and cancellation roles separate", () => {
  assert.equal(roleMaySetItemStatus("KITCHEN", "READY"), true);
  assert.equal(roleMaySetItemStatus("WAITER", "READY"), false);
  assert.equal(roleMaySetItemStatus("WAITER", "SERVED"), true);
  assert.equal(roleMaySetItemStatus("CASHIER", "SERVED"), true);
  assert.equal(roleMaySetItemStatus("CASHIER", "CANCELLED"), true);
  assert.equal(roleMaySetItemStatus("KITCHEN", "CANCELLED"), false);
});