import assert from "node:assert/strict";
import { test } from "node:test";

import { OrderModel } from "./Order.js";

test("order number is unique within each restaurant at the database boundary", () => {
  const index = OrderModel.schema.indexes().find(([keys, options]) =>
    keys.restaurantId === 1 && keys.orderNumber === 1 && options.unique === true
  );
  assert.ok(index, "expected a unique compound index on restaurantId and orderNumber");
});
