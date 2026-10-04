import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Brand } from "@/shared/components/brand";
import {
  ApiError,
  api,
  apiIsConfigured,
  setAccessToken,
} from "@/shared/lib/api";
import { usePos } from "@/shared/store/pos-store";
import {
  clearPhoneRecaptcha,
  firebasePhoneErrorMessage,
  firebasePhoneAuthConfigured,
  firebasePhoneTestMode,
  renderFirebasePhoneRecaptcha,
  requestFirebasePhoneCode,
  type FirebasePhoneConfirmation,
} from "./firebase-phone-auth";

type VerificationStep = "phone" | "code";
type RecaptchaState = "loading" | "ready" | "verified" | "failed";

interface CustomerVerificationState {
  from?: unknown;
}

const indianMobileNumber = (value: string): string | undefined => {
  const digits = value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : undefined;
};

const fictionalTestPhoneNumber = (value: string): string | undefined => {
  const normalized = value.replace(/[\s()-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : undefined;
};

const remainingLabel = (seconds: number) => `Resend in ${seconds}s`;

export const CustomerVerificationPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, login } = usePos();
  const [step, setStep] = useState<VerificationStep>("phone");
  const [mobileInput, setMobileInput] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "verifying" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [resendAfter, setResendAfter] = useState(0);
  const [recaptchaState, setRecaptchaState] = useState<RecaptchaState>("loading");
  const [recaptchaAttempt, setRecaptchaAttempt] = useState(0);
  const confirmation = useRef<FirebasePhoneConfirmation>();
  const recaptchaContainer = useRef<HTMLDivElement>(null);
  const otpDialog = useRef<HTMLDialogElement>(null);
  const otpInput = useRef<HTMLInputElement>(null);
  const phone = useMemo(
    () => firebasePhoneTestMode ? fictionalTestPhoneNumber(mobileInput) : indianMobileNumber(mobileInput),
    [mobileInput],
  );
  const phoneEnding = phone?.slice(-4) ?? "";
  const maskedPhone = firebasePhoneTestMode
    ? `+${String.fromCharCode(0x2022).repeat(Math.max(4, (phone?.length ?? 5) - 5))}${phoneEnding}`
    : `+91 ${String.fromCharCode(0x2022).repeat(6)}${phoneEnding}`;
  const routeState = location.state as CustomerVerificationState | null;
  const returnTo =
    typeof routeState?.from === "string" && routeState.from.startsWith("/menu")
      ? routeState.from
      : "/menu";
  const phoneAuthAvailable = apiIsConfigured && firebasePhoneAuthConfigured;
  const requiresSecurityCheck = !firebasePhoneTestMode;

  useEffect(() => {
    if (resendAfter <= 0) return;
    const timer = window.setInterval(
      () => setResendAfter((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [resendAfter]);

  useEffect(() => {
    if (!phoneAuthAvailable || step !== "phone" || !recaptchaContainer.current) return;
    let mounted = true;
    setRecaptchaState("loading");
    void renderFirebasePhoneRecaptcha(recaptchaContainer.current, {
      onSolved: () => {
        if (mounted) setRecaptchaState("verified");
      },
      onExpired: () => {
        if (mounted) setRecaptchaState("ready");
      },
    })
      .then(() => {
        if (mounted) {
          setRecaptchaState((current) => current === "verified" ? current : "ready");
        }
      })
      .catch((error) => {
        if (!mounted) return;
        setRecaptchaState("failed");
        setStatus("error");
        setMessage(firebasePhoneErrorMessage(error, "send"));
      });
    return () => {
      mounted = false;
      clearPhoneRecaptcha();
    };
  }, [phoneAuthAvailable, recaptchaAttempt, step]);

  useEffect(() => {
    const dialog = otpDialog.current;
    if (!dialog) return;
    if (step === "code") {
      if (!dialog.open) dialog.showModal();
      window.requestAnimationFrame(() => otpInput.current?.focus());
    } else if (dialog.open) {
      dialog.close();
    }
  }, [step]);

  const useAnotherNumber = () => {
    clearPhoneRecaptcha();
    confirmation.current = undefined;
    setStep("phone");
    setCode("");
    setMessage("");
    setStatus("idle");
  };

  const reloadSecurityCheck = () => {
    clearPhoneRecaptcha();
    setRecaptchaAttempt((current) => current + 1);
    setMessage("");
    setStatus("idle");
  };

  const requestAnotherCode = () => {
    clearPhoneRecaptcha();
    confirmation.current = undefined;
    setStep("phone");
    setCode("");
    setStatus("idle");
    setMessage(requiresSecurityCheck ? "Complete the Google security check again, then select Send OTP to request another code." : "");
    if (requiresSecurityCheck) setRecaptchaAttempt((current) => current + 1);
  };

  const requestCode = async () => {
    if (!phone) {
      setMessage(firebasePhoneTestMode ? "Enter a fictional test phone number in international format." : "Enter a valid 10-digit Indian mobile number.");
      setStatus("error");
      return;
    }
    if (requiresSecurityCheck && recaptchaState !== "verified") {
      setMessage("Complete the Google security check before requesting a code.");
      setStatus("error");
      return;
    }
    setStatus("sending");
    setMessage("");
    try {
      confirmation.current = await requestFirebasePhoneCode(phone);
      setStep("code");
      setCode("");
      setResendAfter(30);
      setStatus("idle");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : firebasePhoneErrorMessage(error, "send"));
      setStatus("error");
      if (requiresSecurityCheck) {
        clearPhoneRecaptcha();
        setRecaptchaAttempt((current) => current + 1);
      }
    }
  };

  const verifyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!phone) {
      setStep("phone");
      setMessage("Enter your mobile number again before confirming the code.");
      setStatus("error");
      return;
    }
    setStatus("verifying");
    setMessage("");
    try {
      if (!confirmation.current)
        throw new Error(
          "Request a new code before confirming your mobile number.",
        );
      const firebaseResult = await confirmation.current.confirm(code);
      const result = await api.auth.verifyCustomerFirebase({
        idToken: await firebaseResult.user.getIdToken(),
      });
      setAccessToken(result.accessToken);
      login("CUSTOMER", result.user.name, result.accessToken);
      navigate(returnTo, { replace: true, state: { proceedOrder: true } });
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : firebasePhoneErrorMessage(error, "verify"));
      setStatus("error");
    }
  };

  return (
    <main className="login-page customer-verification-page">
      <section className="login-story">
        <div className="login-story__backdrop" aria-hidden="true">
          <span className="login-plate login-plate--one" />
          <span className="login-plate login-plate--two" />
          <span className="login-flame" />
        </div>
        <Brand inverse />
        <div className="login-story__copy">
          <span className="eyebrow eyebrow--saffron">
            A quick, secure confirmation
          </span>
          <h1>
            One number.
            <br />
            <em>Then dinner is on its way.</em>
          </h1>
          <p>
            We use a one-time SMS code to make sure your order and updates stay
            with you.
          </p>
          <ul>
            <li>
              <CheckCircle2 size={18} /> No customer password or account setup
            </li>
            <li>
              <CheckCircle2 size={18} /> Your saved tray stays ready
            </li>
            <li>
              <CheckCircle2 size={18} /> Your order continues after confirmation
            </li>
          </ul>
        </div>
        <footer>
          <span>Ember &amp; Grain</span>
          <span>Restaurant service</span>
        </footer>
      </section>
      <section className="login-form-shell">
        <div className="login-form-shell__top">
          <Link to={returnTo} className="back-to-menu">
            <ArrowLeft size={15} /> Back to menu
          </Link>
          <span className="login-secure">
            <ShieldCheck size={16} /> Protected by mobile verification
          </span>
        </div>
        <div className="login-form">
          <div>
            <span className="eyebrow">
              {step === "phone" ? "Confirm your mobile" : "Enter your code"}
            </span>
            <h2>
              {step === "phone" ? "Ready when you are" : "Check your messages"}
            </h2>
            <p>
              {step === "phone"
                ? cart.length
                  ? `Your ${cart.length} ${cart.length === 1 ? "item is" : "items are"} saved. Enter your mobile number to send the order.`
                  : "Choose your dishes first, then use your mobile number to securely place the order."
                : firebasePhoneTestMode
                  ? `Enter the configured test code for ${maskedPhone}.`
                  : `Enter the 6-digit SMS code sent to ${maskedPhone}.`}
            </p>
          </div>
          {!phoneAuthAvailable && (
            <p className="login-error" role="status">
              <CircleAlert size={17} /> Mobile OTP is not configured on this site yet.
            </p>
          )}
          {step === "phone" && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void requestCode();
              }}
            >
              <label className="form-field">
                <span>{firebasePhoneTestMode ? "Fictional test number" : "Mobile number"}</span>
                <div className="customer-mobile-input">
                  {!firebasePhoneTestMode && <span aria-hidden="true">+91</span>}
                  <Smartphone size={18} />
                  <input
                    type="tel"
                    value={mobileInput}
                    onChange={(event) =>
                      setMobileInput(
                        event.target.value.replace(/[^0-9+ -]/g, ""),
                      )
                    }
                    autoComplete={firebasePhoneTestMode ? "tel" : "tel-national"}
                    inputMode="numeric"
                    maxLength={firebasePhoneTestMode ? 16 : 15}
                    placeholder={firebasePhoneTestMode ? "+1 650 555 3434" : "98765 43210"}
                    aria-describedby="mobile-help"
                    required
                    autoFocus
                  />
                </div>
              </label>
              <p id="mobile-help" className="form-help">
                {firebasePhoneTestMode
                  ? "Test mode is active. Use a fictional Firebase test number and its configured 6-digit code. No SMS will be sent."
                  : "Complete the Google security check below. Send OTP unlocks when it is complete."}
              </p>
              {firebasePhoneTestMode ? (
                <div ref={recaptchaContainer} className="customer-recaptcha__test-verifier" aria-hidden="true" />
              ) : (
                <section className="customer-recaptcha" aria-labelledby="security-check-title">
                <div className="customer-recaptcha__heading">
                  <span id="security-check-title"><ShieldCheck size={16} /> Security check</span>
                  <span aria-live="polite">
                    {recaptchaState === "verified" ? "Complete" : recaptchaState === "loading" ? "Loading…" : "Required"}
                  </span>
                </div>
                <div ref={recaptchaContainer} className="customer-recaptcha__widget" />
                {recaptchaState !== "verified" && (
                  <p className="form-help">
                    {recaptchaState === "failed"
                      ? "The security check could not load. Reload it and try again."
                      : "Check the box or complete Google’s prompt to continue."}
                  </p>
                )}
                {recaptchaState === "failed" && (
                  <button type="button" className="customer-recaptcha__reload" onClick={reloadSecurityCheck}>
                    Reload security check
                  </button>
                )}
                </section>
              )}
              {message && (
                <p className="login-error" role="alert">
                  <CircleAlert size={17} /> {message}
                </p>
              )}
              <button
                type="submit"
                className="button button--saffron button--full login-submit"
                disabled={status === "sending" || !phoneAuthAvailable || (requiresSecurityCheck && recaptchaState !== "verified")}
              >
                {!phoneAuthAvailable ? (
                  "Mobile OTP unavailable"
                ) : status === "sending" ? (
                  "Sending secure code..."
                ) : requiresSecurityCheck && recaptchaState !== "verified" ? (
                  "Complete security check"
                ) : (
                  <>
                    Send OTP <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}
          <div className="login-form__foot">
            <LockKeyhole size={15} /> Your mobile number is used to confirm and
            identify this order.
          </div>
        </div>
      </section>
      <dialog
        ref={otpDialog}
        className="otp-dialog"
        aria-labelledby="otp-dialog-title"
        aria-describedby="otp-dialog-description"
        onCancel={(event) => {
          event.preventDefault();
          useAnotherNumber();
        }}
      >
        <div className="otp-dialog__content">
          <div className="otp-dialog__top">
            <span className="otp-dialog__badge">
              <MessageSquareText size={17} /> {firebasePhoneTestMode ? "Test code ready" : "Code sent"}
            </span>
            <button
              type="button"
              className="otp-dialog__close"
              onClick={useAnotherNumber}
              aria-label="Back to phone entry"
            >
              <ArrowLeft size={17} />
            </button>
          </div>
          <h2 id="otp-dialog-title">Enter your 6-digit code</h2>
          <p id="otp-dialog-description">
            {firebasePhoneTestMode
              ? `No SMS was sent. Enter the 6-digit code configured for ${maskedPhone} in Firebase.`
              : `We sent a one-time code to ${maskedPhone}. It expires shortly for your security.`}
          </p>
            <form onSubmit={verifyCode}>
              <label className="form-field">
                <span>6-digit OTP</span>
                <div className="otp-code-input">
                  <MessageSquareText size={18} />
                  <input
                    ref={otpInput}
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder={Array(6).fill(String.fromCharCode(0x2022)).join(" ")}
                    aria-describedby="otp-help"
                    required
                  />
                </div>
              </label>
              <p id="otp-help" className="form-help">
                {firebasePhoneTestMode
                  ? "This free Firebase test flow only accepts the code configured for this fictional number."
                  : "For your security, this code expires shortly after it is sent."}
              </p>
              {message && (
                <p
                  className={status === "error" ? "login-error" : "form-help"}
                  role={status === "error" ? "alert" : "status"}
                >
                  {status === "error" && <CircleAlert size={17} />} {message}
                </p>
              )}
              <button
                type="submit"
                className="button button--saffron button--full login-submit"
                disabled={
                  status === "verifying" ||
                  code.length !== 6 ||
                  !phoneAuthAvailable
                }
              >
                {!phoneAuthAvailable ? (
                  "Mobile OTP unavailable"
                ) : status === "verifying" ? (
                  "Confirming and sending order..."
                ) : (
                  <>
                    Confirm OTP &amp; place order <ArrowRight size={18} />
                  </>
                )}
              </button>
              <div className="customer-otp-actions">
                <button
                  type="button"
                  onClick={useAnotherNumber}
                >
                  Use another number
                </button>
                <button
                  type="button"
                  onClick={requestAnotherCode}
                  disabled={resendAfter > 0}
                >
                  {resendAfter > 0 ? remainingLabel(resendAfter) : "Request another code"}
                </button>
              </div>
            </form>
        </div>
      </dialog>
    </main>
  );
};
