import { useState } from "react";
import { ArrowRight, CheckCircle2, ChefHat, CircleAlert, Clock3, CreditCard, LockKeyhole, Mail, ShieldCheck, Smartphone, UsersRound, UtensilsCrossed } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "@/shared/components/brand";
import { ApiError, api, apiIsConfigured, setAccessToken } from "@/shared/lib/api";
import { usePos } from "@/shared/store/pos-store";
import type { Role } from "@/shared/types/domain";

const roleDetails: Record<Role, { label: string; description: string; icon: typeof CreditCard; path: string; email: string; }> = {
  CASHIER: { label: "Cashier", description: "Orders, payments and shifts", icon: CreditCard, path: "/cashier", email: "cashier@ember.local" },
  WAITER: { label: "Waiter", description: "Tables, courses and service", icon: UsersRound, path: "/waiter", email: "waiter@ember.local" },
  KITCHEN: { label: "Kitchen", description: "Tickets and preparation", icon: ChefHat, path: "/kitchen", email: "kitchen@ember.local" },
  CUSTOMER: { label: "Guest", description: "Menu, orders and favourites", icon: UtensilsCrossed, path: "/menu", email: "guest@ember.local" },
};

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = usePos();
  const [role, setRole] = useState<Role>("CASHIER");
  const [email, setEmail] = useState(roleDetails.CASHIER.email);
  const [password, setPassword] = useState("demo-password");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const details = roleDetails[role];
  const selectRole = (nextRole: Role) => {
    setRole(nextRole);
    setEmail(roleDetails[nextRole].email);
    setMessage("");
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const result = await api.auth.login({ email, password });
      setAccessToken(result.accessToken);
      const actualRole = result.user.role;
      login(actualRole, result.user.name, result.accessToken);
      navigate(roleDetails[actualRole].path);
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : "Cannot reach the EmberServe API. Check the connection and try again.";
      setMessage(errorMessage);
      setStatus("error");
    }
  };
  const enterPreview = () => {
    login(role, `Preview ${details.label}`, undefined, true);
    navigate(details.path);
  };

  return <main className="login-page"><section className="login-story"><div className="login-story__backdrop" aria-hidden="true"><span className="login-plate login-plate--one" /><span className="login-plate login-plate--two" /><span className="login-flame" /></div><Brand inverse /><div className="login-story__copy"><span className="eyebrow eyebrow--saffron">One service, in sync</span><h1>Every hand in the house <em>knows what’s next.</em></h1><p>EmberServe keeps the floor, kitchen and register in a single, calm rhythm — even on the rush.</p><ul><li><CheckCircle2 size={18} /> Live kitchen and table updates</li><li><CheckCircle2 size={18} /> Protected role-specific workspaces</li><li><CheckCircle2 size={18} /> Built for touch and fast service</li></ul></div><footer><span>Ember &amp; Grain</span><span>Indiranagar · Bengaluru</span></footer></section><section className="login-form-shell"><div className="login-form-shell__top"><Link to="/menu" className="back-to-menu">← Browse guest menu</Link><span className="login-secure"><ShieldCheck size={16} /> Secure staff access</span></div><div className="login-form"><div><span className="eyebrow">Welcome back</span><h2>Choose your workspace</h2><p>Sign in with your EmberServe staff account.</p></div>{!apiIsConfigured && <p className="login-error" role="status"><CircleAlert size={17} /> Live staff access is not configured on this site yet. Use Preview or run the local stack.</p>}<div className="role-select" role="radiogroup" aria-label="Select your role">{(Object.keys(roleDetails) as Role[]).map((key) => { const option = roleDetails[key]; const Icon = option.icon; return <button type="button" role="radio" aria-checked={role === key} className={role === key ? "role-option role-option--active" : "role-option"} onClick={() => selectRole(key)} key={key}><span><Icon size={19} /></span><div><strong>{option.label}</strong><small>{option.description}</small></div>{role === key && <CheckCircle2 size={18} />}</button>; })}</div><form onSubmit={submit}><label className="form-field"><span>Email or staff ID</span><div><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></div></label><label className="form-field"><span>Password</span><div><LockKeyhole size={18} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></div></label><div className="form-options"><label><input type="checkbox" /> Keep this device signed in</label><button type="button">Forgot password?</button></div>{message && <p className="login-error" role="alert"><CircleAlert size={17} /> {message}</p>}<button type="submit" className="button button--saffron button--full login-submit" disabled={status === "loading" || !apiIsConfigured}>{!apiIsConfigured ? "Live staff access unavailable" : status === "loading" ? "Signing in…" : <>Sign in to {details.label} <ArrowRight size={18} /></>}</button></form><div className="preview-entry"><div><Smartphone size={19} /><span><strong>Want a quick tour?</strong><small>Open a safe, local preview without an API session.</small></span></div><button type="button" onClick={enterPreview}>Preview {details.label} <ArrowRight size={15} /></button></div><div className="login-form__foot"><Clock3 size={15} /> Shift support is available 7 days a week.</div></div></section></main>;
};
