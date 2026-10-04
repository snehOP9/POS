import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
};

const testMode = import.meta.env.DEV && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("firebaseTest") === "1";

export const firebasePhoneAuthConfigured = testMode || Object.values(firebaseConfig).every(Boolean);

interface PhoneConfirmation {
  confirm: (code: string) => Promise<{ user: { getIdToken: () => Promise<string> } }>;
}

let verifier: RecaptchaVerifier | undefined;

const firebasePhoneErrorMessages: Record<string, string> = {
  "auth/captcha-check-failed": "Google reCAPTCHA could not verify this request. Complete the challenge if it appears, then try again.",
  "auth/code-expired": "That code has expired. Request a new code and try again.",
  "auth/invalid-app-credential": "Google reCAPTCHA could not verify this request. Complete the challenge if it appears, then try again.",
  "auth/invalid-phone-number": "Enter a valid mobile number before requesting a code.",
  "auth/invalid-verification-code": "That 6-digit code is incorrect. Check the SMS and try again.",
  "auth/network-request-failed": "We could not reach the SMS service. Check your connection and try again.",
  "auth/operation-not-allowed": "SMS sign-in is not enabled for this restaurant yet. Please ask the restaurant to enable Phone in Firebase Authentication.",
  "auth/quota-exceeded": "SMS delivery is temporarily unavailable. Please try again shortly.",
  "auth/session-expired": "That verification session expired. Request a new code and try again.",
  "auth/too-many-requests": "Too many codes were requested. Wait a few minutes before trying again.",
  "auth/unauthorized-domain": "This ordering site is not authorized for SMS verification yet. Please contact the restaurant.",
};

export function firebasePhoneErrorMessage(error: unknown, action: "send" | "verify"): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code
    : undefined;
  if (typeof code === "string" && firebasePhoneErrorMessages[code]) {
    return firebasePhoneErrorMessages[code];
  }
  return action === "send"
    ? "We could not send a code. Please check your connection and try again."
    : "We could not confirm that code. Please try again.";
}

function auth() {
  if (!firebasePhoneAuthConfigured || testMode) throw new Error("Firebase Phone Auth is not configured");
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const firebaseAuth = getAuth(app);
  firebaseAuth.languageCode = "en";
  return firebaseAuth;
}

export function clearPhoneRecaptcha() {
  verifier?.clear();
  verifier = undefined;
}

export async function requestFirebasePhoneCode(phone: string, container: HTMLElement): Promise<PhoneConfirmation> {
  if (testMode) {
    return {
      confirm: async (code: string) => {
        if (code !== "123456") throw new Error("Enter the test code 123456.");
        return { user: { getIdToken: async () => `firebase-test-phone:${phone}` } };
      },
    };
  }

  clearPhoneRecaptcha();
  verifier = new RecaptchaVerifier(auth(), container, { size: "invisible" });
  const confirmation = await signInWithPhoneNumber(auth(), phone, verifier);
  return confirmation;
}

export type FirebasePhoneConfirmation = ConfirmationResult | PhoneConfirmation;
