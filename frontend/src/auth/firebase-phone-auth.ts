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
