import { createHash, randomBytes } from "node:crypto";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

import { env } from "../config/env.js";
import { badRequest, serviceUnavailable } from "../lib/errors.js";
import { logger } from "../config/logger.js";

export const customerOtpConfigured = Boolean(env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64);

interface FirebaseServiceAccount {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

function firebaseServiceAccount(): FirebaseServiceAccount {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64) {
    throw serviceUnavailable(
      "OTP_DELIVERY_NOT_CONFIGURED",
      "Mobile verification is not configured for this restaurant yet. Please ask the restaurant to enable SMS delivery."
    );
  }
  try {
    const parsed = JSON.parse(Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, "base64url").toString("utf8")) as FirebaseServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) throw new Error("service account is incomplete");
    return parsed;
  } catch (error) {
    logger.error({ err: error }, "Firebase service account configuration is invalid");
    throw serviceUnavailable("OTP_DELIVERY_NOT_CONFIGURED", "Mobile verification is not configured for this restaurant yet. Please ask the restaurant to enable SMS delivery.");
  }
}

function firebaseAuth() {
  const account = firebaseServiceAccount();
  const app = getApps()[0] ?? initializeApp({
    credential: cert({
      projectId: account.project_id!,
      clientEmail: account.client_email!,
      privateKey: account.private_key!
    })
  });
  return getAuth(app);
}

export async function verifyCustomerFirebaseIdToken(idToken: string): Promise<string> {
  try {
    const decoded = await firebaseAuth().verifyIdToken(idToken, true);
    const provider = decoded.firebase?.sign_in_provider;
    if (provider !== "phone" || !decoded.phone_number) {
      throw badRequest("OTP_INVALID", "Please verify your mobile number again before placing the order.");
    }
    return decoded.phone_number;
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "OTP_INVALID") throw error;
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
