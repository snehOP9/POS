import assert from "node:assert/strict";
import { test } from "node:test";

import { createWithUniqueOrderNumber } from "./uniqueOrderNumber.js";

test("order number persistence retries only unique index collisions", async () => {
  let attempts = 0;
  const saved = await createWithUniqueOrderNumber("TST", async (number) => {
    attempts += 1;
    if (attempts === 1) {
      throw Object.assign(new Error("duplicate order number"), {
        code: 11000,
        keyPattern: { restaurantId: 1, orderNumber: 1 }
      });
    }
    return { number };
  });

  assert.equal(attempts, 2);
  assert.match(saved.number, /^TST-/);
});

test("order number persistence does not retry unrelated errors", async () => {
  let attempts = 0;
  await assert.rejects(
    createWithUniqueOrderNumber("TST", async () => {
      attempts += 1;
      throw new Error("database unavailable");
    }),
    /database unavailable/
  );
  assert.equal(attempts, 1);
});

test("order number persistence returns a conflict after repeated collisions", async () => {
  let attempts = 0;
  await assert.rejects(
    createWithUniqueOrderNumber("TST", async () => {
      attempts += 1;
      throw Object.assign(new Error("duplicate order number"), {
        code: 11000,
        keyPattern: { restaurantId: 1, orderNumber: 1 }
      });
    }, 3),
    /Unable to allocate a unique order number/
  );
  assert.equal(attempts, 3);
});
