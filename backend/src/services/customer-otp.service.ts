import { createHash, randomBytes } from "node:crypto";

import { env } from "../config/env.js";
import { badRequest, serviceUnavailable } from "../lib/errors.js";
import { logger } from "../config/logger.js";

const twilioVerifyBaseUrl = "https://verify.twilio.com/v2";

export const customerOtpConfigured = Boolean(
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_VERIFY_SERVICE_SID
);

function twilioAuthorizationHeader(): string {
  return `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`;
}

async function twilioVerify(path: string, payload: URLSearchParams): Promise<Record<string, unknown>> {
  if (!customerOtpConfigured) {
    throw serviceUnavailable(
      "OTP_DELIVERY_NOT_CONFIGURED",
      "Mobile verification is not configured for this restaurant yet. Please ask the restaurant to enable SMS delivery."
    );
  }

  const response = await fetch(`${twilioVerifyBaseUrl}/Services/${encodeURIComponent(env.TWILIO_VERIFY_SERVICE_SID!)}/${path}`, {
    method: "POST",
    headers: {
      Authorization: twilioAuthorizationHeader(),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: payload.toString()
  });
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const responseBody = body as { code?: unknown };
    logger.warn({ statusCode: response.status, twilioCode: responseBody.code }, "Twilio Verify request failed");
    if (response.status === 400 || response.status === 404) {
      throw badRequest("OTP_INVALID", "That verification code is invalid or has expired. Request a new code and try again.");
    }
    throw serviceUnavailable("OTP_DELIVERY_FAILED", "We could not deliver a verification code right now. Please try again shortly.");
  }
  return typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
}

export async function requestCustomerOtp(phone: string): Promise<void> {
  const result = await twilioVerify("Verifications", new URLSearchParams({ To: phone, Channel: "sms" }));
  if (result.status !== "pending") {
    throw serviceUnavailable("OTP_DELIVERY_FAILED", "We could not start mobile verification. Please try again shortly.");
  }
}

export async function verifyCustomerOtp(phone: string, code: string): Promise<void> {
  const result = await twilioVerify("VerificationCheck", new URLSearchParams({ To: phone, Code: code }));
  if (result.status !== "approved") {
    throw badRequest("OTP_INVALID", "That verification code is invalid or has expired. Request a new code and try again.");
  }
}

export function guestAccountEmail(phone: string): string {
  const fingerprint = createHash("sha256").update(phone).digest("hex").slice(0, 40);
  return `guest-${fingerprint}@phone.emberserve.invalid`;
}

export function guestAccountPassword(): string {
  return randomBytes(32).toString("base64url");
}
