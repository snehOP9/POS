import assert from "node:assert/strict";
import test from "node:test";

import { effectiveBasePricePaise } from "./pricing.service.js";

test("catalogue offers are calculated from the authoritative base price", () => {
  assert.equal(effectiveBasePricePaise({ basePricePaise: 42_500 }), 42_500);
  assert.equal(effectiveBasePricePaise({ basePricePaise: 42_500, offer: { percentage: 10, label: "Lunch special" } }), 38_250);
  assert.equal(effectiveBasePricePaise({ basePricePaise: 49_500, offer: { percentage: 12, label: "Biryani hour" } }), 43_560);
});
