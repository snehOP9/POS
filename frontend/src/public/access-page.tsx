import { ArrowRight, ChefHat, CreditCard, ShieldCheck, UsersRound, UtensilsCrossed } from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "@/shared/components/brand";
import { PublicFooter } from "./public-pages";

const staffProfiles = [
  { role: "CASHIER", label: "Cashier", description: "Orders, payments and shifts", icon: CreditCard },
  { role: "WAITER", label: "Waiter", description: "Tables, courses and service", icon: UsersRound },
  { role: "KITCHEN", label: "Kitchen", description: "Tickets and preparation", icon: ChefHat },
] as const;

export const AccessPage = () => <main className="access-page">
  <header className="access-header"><Brand /><Link className="outline-button" to="/menu"><UtensilsCrossed size={16} /> Guest menu</Link></header>
  <section className="access-hero">
    <span className="eyebrow"><ShieldCheck size={15} /> Choose your service path</span>
    <h1>One restaurant, <em>the right workspace</em> for every person.</h1>
    <p>Guest ordering stays simple and account-free. Restaurant colleagues can choose their role and use the protected workspace built for their shift.</p>
  </section>
  <section className="access-profiles" aria-labelledby="access-profiles-title">
    <div className="access-profiles__heading"><span className="eyebrow">Profiles</span><h2 id="access-profiles-title">Where are you headed?</h2></div>
    <div className="access-profiles__grid">
      <Link className="access-profile access-profile--guest" to="/menu">
        <span className="access-profile__icon"><UtensilsCrossed size={24} /></span>
        <div><strong>Guest</strong><small>Browse the menu and place an order directly.</small></div>
        <em>No sign-in required</em><ArrowRight size={18} />
      </Link>
      {staffProfiles.map(({ role, label, description, icon: Icon }) => <Link className="access-profile" to={`/staff/login?role=${role}`} key={role}>
        <span className="access-profile__icon"><Icon size={22} /></span>
        <div><strong>{label}</strong><small>{description}</small></div>
        <em>Staff sign in</em><ArrowRight size={18} />
      </Link>)}
    </div>
  </section>
  <section className="access-note"><ShieldCheck size={19} /><div><strong>Clear access on every screen</strong><p>The same profile choices remain available on phone, tablet and desktop. Staff access requires an authorised account; guests can continue directly to the menu.</p></div></section>
  <PublicFooter />
</main>;
