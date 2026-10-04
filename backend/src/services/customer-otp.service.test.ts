import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../lib/errors.js";
import { phoneFromVerifiedFirebaseToken } from "./customer-otp.service.js";

const now = 1_760_000_000;

test("Firebase phone verification accepts a fresh phone-auth token", () => {
  assert.equal(
    phoneFromVerifiedFirebaseToken({
      auth_time: now - 60,
      firebase: { sign_in_provider: "phone" },
      phone_number: "+919876543210"
    }, now),
    "+919876543210"
  );
});

test("Firebase phone verification rejects non-phone, malformed, and stale claims", () => {
  const invalidPayloads = [
    { auth_time: now, firebase: { sign_in_provider: "password" }, phone_number: "+919876543210" },
    { auth_time: now, firebase: { sign_in_provider: "phone" }, phone_number: "9876543210" },
    { auth_time: now - 601, firebase: { sign_in_provider: "phone" }, phone_number: "+919876543210" }
  ];

  for (const payload of invalidPayloads) {
    assert.throws(
      () => phoneFromVerifiedFirebaseToken(payload, now),
      (error: unknown) => error instanceof AppError && error.code === "OTP_INVALID"
    );
  }
});
