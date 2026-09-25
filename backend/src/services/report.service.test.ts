import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../lib/errors.js";
import { reportSummary, serializeReportSummary } from "./report.service.js";

test("report serialization converts all cashier money values from paise", () => {
  const response = serializeReportSummary({
    from: new Date("2026-09-01T00:00:00.000Z"),
    to: new Date("2026-09-01T23:59:59.999Z"),
    orderCount: 3,
    totalSalesPaise: 368500,
    paidPaise: 310000,
    refundedPaise: 25000,
    averageOrderPaise: 122833,
    byMode: { DINE_IN: 250000, PICKUP: 118500 },
    byProvider: { CASH: 110000, RAZORPAY: 200000 }
  });

  assert.equal(response.totalSales, 3685);
  assert.equal(response.paid, 3100);
  assert.equal(response.refunded, 250);
  assert.equal(response.averageOrder, 1228.33);
  assert.deepEqual(response.byMode, { DINE_IN: 2500, PICKUP: 1185 });
  assert.deepEqual(response.byProvider, { CASH: 1100, RAZORPAY: 2000 });
  assert.equal(response.totalSalesPaise, 368500);
});

test("report service rejects a non-cashier before reading report data", async () => {
  await assert.rejects(
    reportSummary({
      accountId: "staff-account",
      restaurantId: "restaurant",
      role: "WAITER",
      permissions: [],
      tokenVersion: 0
    }, new Date("2026-09-01T00:00:00.000Z"), new Date("2026-09-01T23:59:59.999Z")),
    (error: unknown) => error instanceof AppError && error.code === "AUTH_MISSING_PERMISSION"
  );
});