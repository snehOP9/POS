import { useEffect, useState } from "react";
import { Mail, MapPin, Phone, ShieldCheck, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "@/shared/components/brand";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";
import { usePos } from "@/shared/store/pos-store";
import { api, apiIsConfigured } from "@/shared/lib/api";

type LegalKind = "privacy" | "terms";

type RestaurantInfo = {
  name: string;
  phone?: string;
  supportEmail?: string;
  address?: string;
};

const lastUpdated = "29 September 2026";

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;

const readText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;

const restaurantFromPayload = (payload: unknown): RestaurantInfo => {
  const data = asRecord(payload);
  const restaurant = asRecord(data?.restaurant);
  return {
    name: readText(restaurant?.name) ?? "EmberServe",
    phone: readText(restaurant?.phone),
    supportEmail: readText(restaurant?.supportEmail),
    address: readText(restaurant?.address),
  };
};

const useRestaurantInfo = (enabled = true) => {
  const [restaurant, setRestaurant] = useState<RestaurantInfo>({ name: "EmberServe" });

  useEffect(() => {
    if (!enabled || !apiIsConfigured) return;
    let active = true;
    void api.menu.getPublic().then((payload) => {
      if (active) setRestaurant(restaurantFromPayload(payload));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [enabled]);

  return restaurant;
};

const ContactDetails = ({ restaurant }: { restaurant: RestaurantInfo }) => {
  const hasContact = Boolean(restaurant.phone || restaurant.supportEmail || restaurant.address);
  if (!hasContact) return <p className="public-footer__contact-note">Restaurant contact details will appear here when configured by the operator.</p>;

  return <address className="public-footer__contact">
    {restaurant.phone && <a href={"tel:" + restaurant.phone.replace(/[^+\d]/g, "")}><Phone size={15} /> {restaurant.phone}</a>}
    {restaurant.supportEmail && <a href={"mailto:" + restaurant.supportEmail}><Mail size={15} /> {restaurant.supportEmail}</a>}
    {restaurant.address && <span><MapPin size={15} /> {restaurant.address}</span>}
  </address>;
};

const CookiePreferencesDialog = ({ onClose }: { onClose: () => void }) => {
  const dialogRef = useDialogFocus(true, onClose);
  return <div className="cookie-dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="cookie-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-label="Cookie preferences" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
      <div>
        <span className="eyebrow"><ShieldCheck size={14} /> Cookie preferences</span>
        <h2 id="cookie-dialog-title">No optional cookies are active</h2>
      </div>
      <button type="button" className="icon-button" onClick={onClose} aria-label="Close cookie preferences"><X /></button>
      <p>This build does not load analytics, advertising, or marketing cookies. There is nothing to opt in to or out of.</p>
      <p>When a user signs in, the API can set a secure, HttpOnly refresh-session cookie. The app also keeps the current cart and Preview state in browser local storage. Those storage entries are needed for the ordering experience and can be cleared from the cart or by clearing site data in the browser.</p>
      <button type="button" className="button button--saffron" onClick={onClose}>Done</button>
    </section>
  </div>;
};

export const PublicFooter = () => {
  const { demoMode } = usePos();
  const restaurant = useRestaurantInfo(!demoMode);
  const [cookiesOpen, setCookiesOpen] = useState(false);

  return <footer className="public-footer">
    <div className="public-footer__brand"><Brand inverse /><p>Customer ordering and role-protected restaurant operations in one application.</p></div>
    <nav className="public-footer__nav" aria-label="Site information">
      <Link to="/menu">Menu</Link>
      <Link to="/privacy">Privacy</Link>
      <Link to="/terms">Terms</Link>
      <button type="button" onClick={() => setCookiesOpen(true)} aria-haspopup="dialog">Cookie preferences</button>
    </nav>
    <div className="public-footer__details">
      <strong>{restaurant.name}</strong>
      <ContactDetails restaurant={restaurant} />
    </div>
    <small className="public-footer__legal">Last updated {lastUpdated}. Operational contact information is read from the restaurant configuration.</small>
    {cookiesOpen && <CookiePreferencesDialog onClose={() => setCookiesOpen(false)} />}
  </footer>;
};

const PrivacyNotice = ({ restaurant }: { restaurant: RestaurantInfo }) => <article className="legal-copy">
  <h2>What this notice covers</h2>
  <p>This notice describes the information processed by this EmberServe POS deployment. It applies to the public menu, pickup and table ordering, customer sign-in, and role-protected staff workspaces.</p>
  <h2>Information used to provide the service</h2>
  <p>For a pickup order, the app sends the name and phone number entered at checkout, together with the requested items and optional kitchen note. A table-order link can contain a table token so the server can identify the table. Staff sign-in processes the account email, password submission, role, and session information needed to authorize work.</p>
  <h2>Why it is used</h2>
  <p>The service uses this information to create and update orders, route kitchen work, authenticate staff, protect the service from abuse, and maintain operational audit records. Prices, availability, and order permissions are checked by the server.</p>
  <h2>Browser storage and cookies</h2>
  <p>The customer cart and Preview state are stored in browser local storage. An authenticated API session may use a secure, HttpOnly refresh cookie. This build does not load analytics, advertising, or marketing cookies, pixels, or profiling tools.</p>
  <h2>Service delivery and images</h2>
  <p>Requests are handled by the hosting and API services configured for this deployment. Menu image URLs are supplied by the restaurant configuration and are loaded only to display the menu item.</p>
  <h2>Your choices</h2>
  <p>You can clear the cart in the app, sign out of staff access, or clear this site's browser data. For an order or account request, use the configured restaurant contact below. Do not send passwords or payment secrets by email.</p>
  <h2>Contact</h2>
  <p>Contact <strong>{restaurant.name}</strong> using the configured details below for questions about this deployment or an order.</p>
  <ContactDetails restaurant={restaurant} />
</article>;

const TermsOfUse = ({ restaurant }: { restaurant: RestaurantInfo }) => <article className="legal-copy">
  <h2>Using the public menu</h2>
  <p>The public menu is for browsing current items and submitting an order request. Availability, prices, table eligibility, and order totals are confirmed by the server when an order is created. A menu entry is not a guarantee that an item remains available.</p>
  <h2>Orders and kitchen notes</h2>
  <p>Provide accurate pickup details and review the cart before sending an order. Kitchen notes are passed to the restaurant workflow but do not replace direct confirmation of allergies or dietary needs with restaurant staff.</p>
  <h2>Staff access</h2>
  <p>Staff pages are for authorized restaurant users only. Do not share accounts, session devices, or credentials. The service records operational actions to support restaurant work and security review.</p>
  <h2>Payments</h2>
  <p>This customer interface does not expose a card or wallet checkout flow. Any payment handling made available by the restaurant is subject to the payment method shown at the time of service and to the restaurant's own terms.</p>
  <h2>Acceptable use</h2>
  <p>Do not attempt to bypass role checks, alter requests, interfere with another guest's order, or use the service in a way that disrupts restaurant operations. The service may reject invalid, unauthorized, or rate-limited requests.</p>
  <h2>Contact</h2>
  <p>Questions about a menu order or this application should be directed to <strong>{restaurant.name}</strong> using the configured contact details below.</p>
  <ContactDetails restaurant={restaurant} />
</article>;

export const LegalPage = ({ kind }: { kind: LegalKind }) => {
  const { demoMode } = usePos();
  const restaurant = useRestaurantInfo(!demoMode);
  const isPrivacy = kind === "privacy";
  return <>
    <main className="legal-page">
      <div className="legal-page__heading">
        <span className="eyebrow"><ShieldCheck size={14} /> EmberServe POS</span>
        <h1>{isPrivacy ? "Privacy notice" : "Terms of use"}</h1>
        <p>Effective and last updated {lastUpdated}. This page describes the behavior of this deployment and should be reviewed by the restaurant operator when its data practices change.</p>
      </div>
      {isPrivacy ? <PrivacyNotice restaurant={restaurant} /> : <TermsOfUse restaurant={restaurant} />}
    </main>
    <PublicFooter />
  </>;
};
