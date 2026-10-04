import { createHash, randomBytes } from "node:crypto";

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import { env } from "../config/env.js";
import { AppError, badRequest, serviceUnavailable } from "../lib/errors.js";
import { logger } from "../config/logger.js";

const firebaseSigningKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);
const maximumPhoneAuthenticationAgeSeconds = 10 * 60;

export const customerOtpConfigured = Boolean(env.FIREBASE_PROJECT_ID);

export function phoneFromVerifiedFirebaseToken(payload: JWTPayload, currentTimeSeconds = Math.floor(Date.now() / 1000)): string {
  const provider = (payload.firebase as { sign_in_provider?: unknown } | undefined)?.sign_in_provider;
  const phone = payload.phone_number;
  const authenticationTime = payload.auth_time;
  const authenticationIsFresh = typeof authenticationTime === "number"
    && Number.isSafeInteger(authenticationTime)
    && authenticationTime <= currentTimeSeconds + 60
    && currentTimeSeconds - authenticationTime <= maximumPhoneAuthenticationAgeSeconds;

  if (provider !== "phone" || typeof phone !== "string" || !/^\+[1-9][0-9]{7,14}$/.test(phone) || !authenticationIsFresh) {
    throw badRequest("OTP_INVALID", "Please verify your mobile number again before placing the order.");
  }
  return phone;
}

export async function verifyCustomerFirebaseIdToken(idToken: string): Promise<string> {
  if (!env.FIREBASE_PROJECT_ID) {
    throw serviceUnavailable(
      "OTP_DELIVERY_NOT_CONFIGURED",
      "Mobile verification is not configured for this restaurant yet. Please ask the restaurant to enable SMS delivery."
    );
  }
  try {
    const { payload } = await jwtVerify(idToken, firebaseSigningKeys, {
      algorithms: ["RS256"],
      audience: env.FIREBASE_PROJECT_ID,
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`
    });
    return phoneFromVerifiedFirebaseToken(payload);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.warn({ err: error }, "Firebase phone token verification failed");
    throw badRequest("OTP_INVALID", "That mobile verification has expired or is invalid. Please request a new code and try again.");
  }
}

export function guestAccountEmail(phone: string): string {
  const fingerprint = createHash("sha256").update(phone).digest("hex").slice(0, 40);
  return `guest-${fingerprint}@phone.emberserve.invalid`;
}

export function guestAccountPassword(): string {
  return randomBytes(32).toString("base64url");
}
