import { createHash, randomBytes } from "node:crypto";

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import { env } from "../config/env.js";
import { AppError, badRequest, serviceUnavailable } from "../lib/errors.js";
import { logger } from "../config/logger.js";

const firebaseSigningKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);
const maximumPhoneAuthenticationAgeSeconds = 10 * 60;

interface TwilioVerifyConfiguration {
  accountSid: string;
  authToken: string;
  serviceSid: string;
}

interface TwilioVerifyResponse {
  status?: unknown;
  to?: unknown;
  code?: unknown;
}

type CustomerOtpProvider = "firebase" | "twilio" | "unavailable";

export const twilioVerifyConfigured = Boolean(
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_VERIFY_SERVICE_SID
);

export const customerOtpConfigured = Boolean(env.FIREBASE_PROJECT_ID) || twilioVerifyConfigured;

export function customerOtpProvider(): CustomerOtpProvider {
  if (twilioVerifyConfigured) return "twilio";
  if (env.FIREBASE_PROJECT_ID) return "firebase";
  return "unavailable";
}

function twilioVerifyConfiguration(): TwilioVerifyConfiguration {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_VERIFY_SERVICE_SID) {
    throw serviceUnavailable(
      "OTP_DELIVERY_NOT_CONFIGURED",
      "Mobile verification is not configured for this restaurant yet. Please ask the restaurant to enable SMS delivery."
    );
  }
  return {
    accountSid: env.TWILIO_ACCOUNT_SID,
    authToken: env.TWILIO_AUTH_TOKEN,
    serviceSid: env.TWILIO_VERIFY_SERVICE_SID
  };
}

function twilioStatus(payload: unknown): number | undefined {
  if (typeof payload !== "object" || payload === null || !("status" in payload)) return undefined;
  const status = (payload as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function twilioErrorCode(payload: unknown): number | undefined {
  if (typeof payload !== "object" || payload === null || !("code" in payload)) return undefined;
  const code = (payload as { code?: unknown }).code;
  return typeof code === "number" ? code : undefined;
}

async function twilioVerifyRequest(
  path: "Verifications" | "VerificationCheck",
  form: Record<string, string>
): Promise<TwilioVerifyResponse> {
  const configuration = twilioVerifyConfiguration();
  let response: Response;
  let payload: unknown;
  try {
    response = await fetch(
      `https://verify.twilio.com/v2/Services/${encodeURIComponent(configuration.serviceSid)}/${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${configuration.accountSid}:${configuration.authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json"
        },
        body: new URLSearchParams(form),
        signal: AbortSignal.timeout(10_000)
      }
    );
    payload = await response.json().catch(() => undefined);
  } catch (error) {
    logger.warn({ err: error, provider: "twilio", operation: path }, "Customer OTP provider request failed");
    throw serviceUnavailable("OTP_DELIVERY_UNAVAILABLE", "SMS delivery is temporarily unavailable. Please try again shortly.");
  }

  if (response.ok) return (payload ?? {}) as TwilioVerifyResponse;

  const status = twilioStatus(payload) ?? response.status;
  const code = twilioErrorCode(payload);
  logger.warn({ provider: "twilio", operation: path, status, code }, "Customer OTP provider rejected request");

  if (response.status === 401 || response.status === 403) {
    throw serviceUnavailable("OTP_DELIVERY_NOT_CONFIGURED", "SMS delivery is not configured correctly for this restaurant yet.");
  }
  if (response.status === 429) {
    throw serviceUnavailable("OTP_RATE_LIMITED", "Too many codes were requested. Please wait a few minutes and try again.");
  }
  if (response.status >= 500) {
    throw serviceUnavailable("OTP_DELIVERY_UNAVAILABLE", "SMS delivery is temporarily unavailable. Please try again shortly.");
  }
  if (path === "VerificationCheck") {
    throw badRequest("OTP_INVALID", "That 6-digit code is incorrect or has expired. Request another code and try again.");
  }
  throw badRequest("OTP_DELIVERY_FAILED", "We could not send a code to that mobile number. Check the number and try again.");
}

export async function sendCustomerTwilioCode(phone: string): Promise<void> {
  const payload = await twilioVerifyRequest("Verifications", { To: phone, Channel: "sms" });
  if (payload.status !== "pending") {
    logger.warn({ provider: "twilio", operation: "Verifications", status: typeof payload.status === "string" ? payload.status : undefined }, "Customer OTP provider returned an unexpected send status");
    throw serviceUnavailable("OTP_DELIVERY_UNAVAILABLE", "SMS delivery is temporarily unavailable. Please try again shortly.");
  }
}

export async function verifyCustomerTwilioCode(phone: string, code: string): Promise<string> {
  const payload = await twilioVerifyRequest("VerificationCheck", { To: phone, Code: code });
  if (payload.status !== "approved" || payload.to !== phone) {
    throw badRequest("OTP_INVALID", "That 6-digit code is incorrect or has expired. Request another code and try again.");
  }
  return phone;
}

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
