import { useState } from "react";
import { ArrowRight, CheckCircle2, ChefHat, CircleAlert, Clock3, CreditCard, LockKeyhole, Mail, ShieldCheck, Smartphone, UsersRound, UtensilsCrossed } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "@/shared/components/brand";
import { ApiError, api, apiIsConfigured, setAccessToken } from "@/shared/lib/api";
import { usePos } from "@/shared/store/pos-store";
import type { Role } from "@/shared/types/domain";

type LoginAudience = "customer" | "staff";

const roleDetails: Record<Role, { label: string; description: string; icon: typeof CreditCard; path: string }> = {
  CASHIER: { label: "Cashier", description: "Orders, payments and shifts", icon: CreditCard, path: "/cashier" },
  WAITER: { label: "Waiter", description: "Tables, courses and service", icon: UsersRound, path: "/waiter" },
  KITCHEN: { label: "Kitchen", description: "Tickets and preparation", icon: ChefHat, path: "/kitchen" },
  CUSTOMER: { label: "Guest", description: "Menu, orders and favourites", icon: UtensilsCrossed, path: "/menu" },
};

const staffRoles: Role[] = ["CASHIER", "WAITER", "KITCHEN"];

export const LoginPage = ({ audience = "staff" }: { audience?: LoginAudience }) => {
  const navigate = useNavigate();
  const { login } = usePos();
  const isCustomer = audience === "customer";
  const allowedRoles: Role[] = isCustomer ? ["CUSTOMER"] : staffRoles;
  const [role, setRole] = useState<Role>(isCustomer ? "CUSTOMER" : "CASHIER");
  const [email, setEmail] = useState(() => isCustomer ? "" : window.localStorage.getItem("emberserve.rememberedStaffId") ?? "");
  const [password, setPassword] = useState("");
  const [rememberDevice, setRememberDevice] = useState(() => !isCustomer && Boolean(window.localStorage.getItem("emberserve.rememberedStaffId")));
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const details = roleDetails[role];

  const selectRole = (nextRole: Role) => {
    if (!allowedRoles.includes(nextRole)) return;
    setRole(nextRole);
    if (!rememberDevice) setEmail("");
    setMessage("");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    if (!isCustomer && rememberDevice) window.localStorage.setItem("emberserve.rememberedStaffId", email);
    else window.localStorage.removeItem("emberserve.rememberedStaffId");
    try {
      const result = await api.auth.login({ email, password });
      const actualRole = result.user.role;
      if ((isCustomer && actualRole !== "CUSTOMER") || (!isCustomer && actualRole === "CUSTOMER")) {
        setAccessToken(undefined);
        setMessage(isCustomer ? "This account belongs to the staff workspace. Please use staff sign in." : "Guest accounts sign in from the customer menu.");
        setStatus("error");
        return;
      }
      setAccessToken(result.accessToken);
      login(actualRole, result.user.name, result.accessToken);
      navigate(roleDetails[actualRole].path);
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : "Cannot reach the EmberServe API. Check the connection and try again.";
      setMessage(errorMessage);
      setStatus("error");
    }
  };

  const enterPreview = () => {
    login(role, "Preview " + details.label, undefined, true);
    navigate(details.path);
  };

  return <main className="login-page"><section className="login-story"><div className="login-story__backdrop" aria-hidden="true"><span className="login-plate login-plate--one" /><span className="login-plate login-plate--two" /><span className="login-flame" /></div><Brand inverse /><div className="login-story__copy"><span className="eyebrow eyebrow--saffron">One service, in sync</span><h1>{isCustomer ? <>Your table, <em>your way.</em></> : <>Every hand in the house <em>knows what is next.</em></>}</h1><p>{isCustomer ? "Sign in to place and follow your EmberServe orders." : "EmberServe keeps the floor, kitchen and register in a single, calm rhythm - even on the rush."}</p><ul>{isCustomer ? <><li><CheckCircle2 size={18} /> Place and follow your own orders</li><li><CheckCircle2 size={18} /> Order status updates for your visit</li><li><CheckCircle2 size={18} /> No staff tools in guest access</li></> : <><li><CheckCircle2 size={18} /> Live kitchen and table updates</li><li><CheckCircle2 size={18} /> Protected role-specific workspaces</li><li><CheckCircle2 size={18} /> Built for touch and fast service</li></>}</ul></div><footer><span>Ember &amp; Grain</span><span>Restaurant service</span></footer></section><section className="login-form-shell"><div className="login-form-shell__top"><Link to={isCustomer ? "/staff/login" : "/menu"} className="back-to-menu">{isCustomer ? "Staff sign in" : "Browse guest menu"}</Link><span className="login-secure"><ShieldCheck size={16} /> {isCustomer ? "Secure customer access" : "Secure staff access"}</span></div><div className="login-form"><div><span className="eyebrow">Welcome back</span><h2>{isCustomer ? "Sign in to order" : "Choose your workspace"}</h2><p>{isCustomer ? "Use the customer account created for this restaurant." : "Sign in with your EmberServe staff account."}</p></div>{!apiIsConfigured && <p className="login-error" role="status"><CircleAlert size={17} /> Live access is not configured on this site yet. Use preview or run the local stack.</p>}{!isCustomer && <div className="role-select" role="radiogroup" aria-label="Select your staff role">{allowedRoles.map((key) => { const option = roleDetails[key]; const Icon = option.icon; return <button type="button" role="radio" aria-checked={role === key} className={role === key ? "role-option role-option--active" : "role-option"} onClick={() => selectRole(key)} key={key}><span><Icon size={19} /></span><div><strong>{option.label}</strong><small>{option.description}</small></div>{role === key && <CheckCircle2 size={18} />}</button>; })}</div>}<form onSubmit={submit}><label className="form-field"><span>{isCustomer ? "Email" : "Email or staff ID"}</span><div><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></div></label><label className="form-field"><span>Password</span><div><LockKeyhole size={18} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></div></label><div className="form-options"><label><input type="checkbox" checked={rememberDevice} onChange={(event) => setRememberDevice(event.target.checked)} /> {isCustomer ? "Remember this email on this device" : "Remember staff ID on this device"}</label><button type="button" onClick={() => { setStatus("idle"); setMessage(isCustomer ? "Contact the restaurant if you need help with your account." : "Password resets are managed by the restaurant administrator. Please contact your shift manager."); }}>Forgot password?</button></div>{message && <p className="login-error" role="alert"><CircleAlert size={17} /> {message}</p>}<button type="submit" className="button button--saffron button--full login-submit" disabled={status === "loading" || !apiIsConfigured}>{!apiIsConfigured ? "Live access unavailable" : status === "loading" ? "Signing in..." : <>Sign in <ArrowRight size={18} /></>}</button></form><div className="preview-entry"><div><Smartphone size={19} /><span><strong>Want a quick tour?</strong><small>Open a safe, local preview without an API session.</small></span></div><button type="button" onClick={enterPreview}>Preview {details.label} <ArrowRight size={15} /></button></div><div className="login-form__foot"><Clock3 size={15} /> {isCustomer ? "Customer account help is available from the restaurant." : "Shift support is available 7 days a week."}</div></div></section></main>;
};
