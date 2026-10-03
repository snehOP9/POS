import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, LockKeyhole, MessageSquareText, ShieldCheck, Smartphone } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Brand } from "@/shared/components/brand";
import { ApiError, api, apiIsConfigured, setAccessToken } from "@/shared/lib/api";
import { usePos } from "@/shared/store/pos-store";

type VerificationStep = "phone" | "code";

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
  const [status, setStatus] = useState<"idle" | "sending" | "verifying" | "error">("idle");
  const [message, setMessage] = useState("");
  const [resendAfter, setResendAfter] = useState(0);
  const phone = useMemo(() => indianMobileNumber(mobileInput), [mobileInput]);
  const phoneEnding = phone?.slice(-4) ?? "";
  const routeState = location.state as CustomerVerificationState | null;
  const returnTo = typeof routeState?.from === "string" && routeState.from.startsWith("/menu") ? routeState.from : "/menu";

  useEffect(() => {
    if (resendAfter <= 0) return;
    const timer = window.setInterval(() => setResendAfter((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendAfter]);

  const requestCode = async () => {
    if (!phone) {
      setMessage("Enter a valid 10-digit Indian mobile number.");
      setStatus("error");
      return;
    }
    setStatus("sending");
    setMessage("");
    try {
      await api.auth.requestCustomerOtp({ phone });
      setStep("code");
      setCode("");
      setResendAfter(30);
      setStatus("idle");
      setMessage(`A 6-digit code was sent to +91 ••••••${phoneEnding}.`);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "We could not send a code. Please check your connection and try again.");
      setStatus("error");
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
      const result = await api.auth.verifyCustomerOtp({ phone, code });
      setAccessToken(result.accessToken);
      login("CUSTOMER", result.user.name, result.accessToken);
      navigate(returnTo, { replace: true, state: { proceedOrder: true } });
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "We could not confirm that code. Please try again.");
      setStatus("error");
    }
  };

  return <main className="login-page customer-verification-page"><section className="login-story"><div className="login-story__backdrop" aria-hidden="true"><span className="login-plate login-plate--one" /><span className="login-plate login-plate--two" /><span className="login-flame" /></div><Brand inverse /><div className="login-story__copy"><span className="eyebrow eyebrow--saffron">A quick, secure confirmation</span><h1>One number.<br /><em>Then dinner is on its way.</em></h1><p>We use a one-time SMS code to make sure your order and updates stay with you.</p><ul><li><CheckCircle2 size={18} /> No customer password or account setup</li><li><CheckCircle2 size={18} /> Your saved tray stays ready</li><li><CheckCircle2 size={18} /> Your order continues after confirmation</li></ul></div><footer><span>Ember &amp; Grain</span><span>Restaurant service</span></footer></section><section className="login-form-shell"><div className="login-form-shell__top"><Link to={returnTo} className="back-to-menu"><ArrowLeft size={15} /> Back to menu</Link><span className="login-secure"><ShieldCheck size={16} /> Protected by SMS verification</span></div><div className="login-form"><div><span className="eyebrow">{step === "phone" ? "Confirm your mobile" : "Enter your code"}</span><h2>{step === "phone" ? "Ready when you are" : "Check your messages"}</h2><p>{step === "phone" ? (cart.length ? `Your ${cart.length} ${cart.length === 1 ? "item is" : "items are"} saved. Enter your mobile number to send the order.` : "Choose your dishes first, then use your mobile number to securely place the order.") : `Enter the 6-digit SMS code sent to +91 ••••••${phoneEnding}.`}</p></div>{!apiIsConfigured && <p className="login-error" role="status"><CircleAlert size={17} /> Live ordering is not configured on this site yet.</p>}{step === "phone" ? <form onSubmit={(event) => { event.preventDefault(); void requestCode(); }}><label className="form-field"><span>Mobile number</span><div className="customer-mobile-input"><span aria-hidden="true">+91</span><Smartphone size={18} /><input type="tel" value={mobileInput} onChange={(event) => setMobileInput(event.target.value.replace(/[^0-9+ -]/g, ""))} autoComplete="tel-national" inputMode="numeric" maxLength={15} placeholder="98765 43210" aria-describedby="mobile-help" required autoFocus /></div></label><p id="mobile-help" className="form-help">We will text a one-time 6-digit code. Standard SMS charges may apply.</p>{message && <p className="login-error" role="alert"><CircleAlert size={17} /> {message}</p>}<button type="submit" className="button button--saffron button--full login-submit" disabled={status === "sending" || !apiIsConfigured}>{!apiIsConfigured ? "Live ordering unavailable" : status === "sending" ? "Sending secure code..." : <>Send OTP <ArrowRight size={18} /></>}</button></form> : <form onSubmit={verifyCode}><label className="form-field"><span>6-digit OTP</span><div className="otp-code-input"><MessageSquareText size={18} /><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="• • • • • •" aria-describedby="otp-help" required autoFocus /></div></label><p id="otp-help" className="form-help">For your security, this code expires shortly after it is sent.</p>{message && <p className={status === "error" ? "login-error" : "form-help"} role={status === "error" ? "alert" : "status"}>{status === "error" && <CircleAlert size={17} />} {message}</p>}<button type="submit" className="button button--saffron button--full login-submit" disabled={status === "verifying" || code.length !== 6 || !apiIsConfigured}>{!apiIsConfigured ? "Live ordering unavailable" : status === "verifying" ? "Confirming and sending order..." : <>Confirm OTP &amp; place order <ArrowRight size={18} /></>}</button><div className="customer-otp-actions"><button type="button" onClick={() => { setStep("phone"); setCode(""); setMessage(""); setStatus("idle"); }}>Use another number</button><button type="button" onClick={() => void requestCode()} disabled={resendAfter > 0 || status === "sending"}>{resendAfter > 0 ? remainingLabel(resendAfter) : "Resend OTP"}</button></div></form>}<div className="login-form__foot"><LockKeyhole size={15} /> Your mobile number is used to confirm and identify this order.</div></div></section></main>;
};
