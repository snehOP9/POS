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
  renderFirebasePhoneRecaptcha,
  requestFirebasePhoneCode,
  type FirebasePhoneConfirmation,
} from "./firebase-phone-auth";

type VerificationStep = "phone" | "code";
type RecaptchaState = "loading" | "ready" | "verified" | "failed";
type OtpProvider = "loading" | "firebase" | "twilio" | "unavailable";

interface CustomerVerificationState {
  from?: unknown;
}

const indianMobileNumber = (value: string): string | undefined => {
  const digits = value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : undefined;
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
  const phone = useMemo(() => indianMobileNumber(mobileInput), [mobileInput]);
  const phoneEnding = phone?.slice(-4) ?? "";
  const maskedPhone = `+91 ${String.fromCharCode(0x2022).repeat(6)}${phoneEnding}`;
  const routeState = location.state as CustomerVerificationState | null;
  const returnTo =
    typeof routeState?.from === "string" && routeState.from.startsWith("/menu")
      ? routeState.from
      : "/menu";
  const firebaseTestMode = import.meta.env.DEV && new URLSearchParams(location.search).get("firebaseTest") === "1";
  const [otpProvider, setOtpProvider] = useState<OtpProvider>(firebaseTestMode ? "firebase" : "loading");
  const requiresRecaptcha = otpProvider === "firebase";
  const phoneAuthAvailable = apiIsConfigured && (
    otpProvider === "twilio" || (otpProvider === "firebase" && firebasePhoneAuthConfigured)
  );

  useEffect(() => {
    if (resendAfter <= 0) return;
    const timer = window.setInterval(
      () => setResendAfter((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [resendAfter]);

  useEffect(() => {
    let mounted = true;
    if (!apiIsConfigured) {
      setOtpProvider("unavailable");
      return () => { mounted = false; };
    }
    if (firebaseTestMode) {
      setOtpProvider("firebase");
      return () => { mounted = false; };
    }
    setOtpProvider("loading");
    void api.auth.customerOtpProvider()
      .then(({ provider }) => {
        if (mounted) setOtpProvider(provider);
      })
      .catch(() => {
        if (mounted) setOtpProvider("unavailable");
      });
    return () => { mounted = false; };
  }, [firebaseTestMode]);

  useEffect(() => {
    if (!requiresRecaptcha || !phoneAuthAvailable || step !== "phone" || !recaptchaContainer.current) {
      clearPhoneRecaptcha();
      return;
    }
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
  }, [phoneAuthAvailable, recaptchaAttempt, requiresRecaptcha, step]);

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
    setMessage(requiresRecaptcha ? "Complete the Google security check again, then select Send OTP to request another code." : "");
    if (requiresRecaptcha) setRecaptchaAttempt((current) => current + 1);
  };

  const requestCode = async () => {
    if (!phone) {
      setMessage("Enter a valid 10-digit Indian mobile number.");
      setStatus("error");
      return;
    }
    if (!phoneAuthAvailable) {
      setMessage("Mobile OTP is not configured on this site yet.");
      setStatus("error");
      return;
    }
    if (requiresRecaptcha && recaptchaState !== "verified") {
      setMessage("Complete the Google security check before requesting a code.");
      setStatus("error");
      return;
    }
    setStatus("sending");
    setMessage("");
    try {
      if (otpProvider === "twilio") {
        await api.auth.sendCustomerOtp({ phone });
      } else {
        confirmation.current = await requestFirebasePhoneCode(phone);
      }
      setStep("code");
      setCode("");
      setResendAfter(30);
      setStatus("idle");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : requiresRecaptcha ? firebasePhoneErrorMessage(error, "send") : "We could not send a code right now. Please try again shortly.");
      setStatus("error");
      if (requiresRecaptcha) {
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
      const result = otpProvider === "twilio"
        ? await api.auth.verifyCustomerOtp({ phone, code })
        : await (async () => {
          if (!confirmation.current) throw new Error("Request a new code before confirming your mobile number.");
          const firebaseResult = await confirmation.current.confirm(code);
          return api.auth.verifyCustomerFirebase({ idToken: await firebaseResult.user.getIdToken() });
        })();
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
                : `Enter the 6-digit SMS code sent to ${maskedPhone}.`}
            </p>
          </div>
          {otpProvider === "unavailable" && (
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
                <span>Mobile number</span>
                <div className="customer-mobile-input">
                  <span aria-hidden="true">+91</span>
                  <Smartphone size={18} />
                  <input
                    type="tel"
                    value={mobileInput}
                    onChange={(event) =>
                      setMobileInput(
                        event.target.value.replace(/[^0-9+ -]/g, ""),
                      )
                    }
                    autoComplete="tel-national"
                    inputMode="numeric"
                    maxLength={15}
                    placeholder="98765 43210"
                    aria-describedby="mobile-help"
                    required
                    autoFocus
                  />
                </div>
              </label>
              <p id="mobile-help" className="form-help">
                {otpProvider === "loading"
                  ? "Preparing secure SMS delivery..."
                  : requiresRecaptcha
                    ? "Complete the Google security check below. Send OTP unlocks when it is complete."
                    : "We will text a one-time 6-digit code to confirm this order."}
              </p>
              {requiresRecaptcha && (
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
                disabled={status === "sending" || !phoneAuthAvailable || (requiresRecaptcha && recaptchaState !== "verified")}
              >
                {otpProvider === "loading" ? (
                  "Preparing mobile OTP..."
                ) : !phoneAuthAvailable ? (
                  "Mobile OTP unavailable"
                ) : status === "sending" ? (
                  "Sending secure code..."
                ) : requiresRecaptcha && recaptchaState !== "verified" ? (
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
              <MessageSquareText size={17} /> Code sent
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
            We sent a one-time code to {maskedPhone}. It expires shortly for your security.
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
                For your security, this code expires shortly after it is sent.
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
