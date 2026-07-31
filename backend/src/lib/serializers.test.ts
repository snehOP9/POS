import assert from "node:assert/strict";
import test from "node:test";

import { Types } from "mongoose";

import { serializeKitchenOrder, serializeOrder, serializeWaiterOrder } from "./serializers.js";
import type { Order } from "../models/Order.js";

const fixtureOrder = (): Order & { _id: Types.ObjectId } => {
  const id = new Types.ObjectId();
  return {
    _id: id,
    restaurantId: new Types.ObjectId(),
    orderNumber: "EMBER-1042",
    mode: "DINE_IN",
    tableId: new Types.ObjectId(),
    customerId: new Types.ObjectId(),
    createdByAccountId: new Types.ObjectId(),
    guestName: "Asha",
    guestPhone: "+919999999999",
    status: "PREPARING",
    paymentStatus: "PAID",
    source: "CUSTOMER",
    version: 2,
    items: [{
      lineId: "d4f65d2c-7063-45c9-bf83-8bdb28201921",
      menuItemId: new Types.ObjectId(),
      name: "Saffron Paneer Tikka",
      quantity: 1,
      unitBasePricePaise: 42500,
      modifiers: [],
      unitPricePaise: 42500,
      lineSubtotalPaise: 42500,
      status: "PREPARING",
      station: "TANDOOR"
    }],
    pricing: {
      currency: "INR",
      subtotalPaise: 42500,
      taxPaise: 2125,
      serviceChargePaise: 0,
      discountPaise: 0,
      grandTotalPaise: 44625
    },
    timeline: [{
      type: "ORDER_CREATED",
      timestamp: new Date(),
      source: "API"
    }]
  };
};

test("staff-specific order projections do not expose customer financial data", () => {
  const order = fixtureOrder();
  const kitchen = serializeKitchenOrder(order);
  const waiter = serializeWaiterOrder(order);
  const cashier = serializeOrder(order);

  assert.equal("pricing" in kitchen, false);
  assert.equal("paymentStatus" in kitchen, false);
  assert.equal("guestPhone" in kitchen, false);
  assert.equal("unitPrice" in kitchen.items[0], false);

  assert.equal("pricing" in waiter, false);
  assert.equal("paymentStatus" in waiter, false);
  assert.equal("guestPhone" in waiter, false);

  assert.equal(cashier.paymentStatus, "PAID");
  assert.equal(cashier.pricing.grandTotalPaise, 44625);
});
