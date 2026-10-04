import { useEffect, useState } from "react";
import { Globe2, Mail, MapPin, Phone, ShieldCheck, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "@/shared/components/brand";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";
import { api, apiIsConfigured } from "@/shared/lib/api";
import { usePos } from "@/shared/store/pos-store";

type LegalKind = "privacy" | "terms" | "contact";

type RestaurantInfo = {
  name: string;
  phone?: string;
  supportEmail?: string;
  address?: string;
};

const lastUpdated = "5 October 2026";

const platformContact = {
  name: "Sneh Raunak",
  website: "https://snehraunak.in",
  email: "sneh.raunak@gmail.com",
  phone: "+91 92419 20176",
};

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

const RestaurantContactDetails = ({ restaurant }: { restaurant: RestaurantInfo }) => {
  const hasContact = Boolean(restaurant.phone || restaurant.supportEmail || restaurant.address);
  if (!hasContact) return <p className="public-footer__contact-note">Restaurant-specific order contact details are not published in this deployment.</p>;

  return <address className="public-footer__contact">
    {restaurant.phone && <a href={"tel:" + restaurant.phone.replace(/[^+\d]/g, "")}><Phone size={15} /> {restaurant.phone}</a>}
    {restaurant.supportEmail && <a href={"mailto:" + restaurant.supportEmail}><Mail size={15} /> {restaurant.supportEmail}</a>}
    {restaurant.address && <span><MapPin size={15} /> {restaurant.address}</span>}
  </address>;
};

const PlatformContactDetails = () => <address className="public-footer__contact public-footer__contact--platform">
  <a href={platformContact.website} target="_blank" rel="noreferrer"><Globe2 size={15} /> snehraunak.in</a>
  <a href={"mailto:" + platformContact.email}><Mail size={15} /> {platformContact.email}</a>
  <a href={"tel:" + platformContact.phone.replace(/[^+\d]/g, "")}><Phone size={15} /> {platformContact.phone}</a>
</address>;

const CookiePreferencesDialog = ({ onClose }: { onClose: () => void }) => {
  const dialogRef = useDialogFocus(true, onClose);
  return <div className="cookie-dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="cookie-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="cookie-dialog-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
      <div>
        <span className="eyebrow"><ShieldCheck size={14} /> Cookie and storage notice</span>
        <h2 id="cookie-dialog-title">Essential storage supports the service</h2>
      </div>
      <button type="button" className="icon-button" onClick={onClose} aria-label="Close cookie and storage notice"><X /></button>
      <p>This application uses only the browser storage and cookies necessary to keep a customer cart available, maintain an authenticated staff or customer session, protect the service against abuse, and remember the temporary state of an order journey. The current application does not intentionally load advertising pixels, behavioural advertising cookies, or marketing analytics cookies.</p>
      <p>When phone verification is requested, Firebase Authentication and its security controls may process technical identifiers and set or access storage needed to prevent automated abuse and complete the verification request. These services are not optional for a phone-verification request; choosing not to proceed simply means no verification code is requested. You can remove local storage and cookies from your browser settings at any time, although doing so may sign you out or clear an unfinished cart.</p>
      <button type="button" className="button button--saffron" onClick={onClose}>Understood</button>
    </section>
  </div>;
};

export const PublicFooter = () => {
  const { demoMode } = usePos();
  const restaurant = useRestaurantInfo(!demoMode);
  const [cookiesOpen, setCookiesOpen] = useState(false);

  return <footer className="public-footer">
    <div className="public-footer__brand"><Brand inverse /><p>Customer ordering and role-protected restaurant operations in one application, with clear information about how the service handles customer, staff, and order data.</p></div>
    <nav className="public-footer__nav" aria-label="Site information">
      <Link to="/menu">Menu</Link>
      <Link to="/privacy">Privacy notice</Link>
      <Link to="/terms">Terms of use</Link>
      <Link to="/contact">Contact and data requests</Link>
      <button type="button" onClick={() => setCookiesOpen(true)} aria-haspopup="dialog">Cookie and storage notice</button>
    </nav>
    <div className="public-footer__details">
      <div className="public-footer__section"><strong>Platform and privacy contact</strong><PlatformContactDetails /></div>
      <div className="public-footer__section"><strong>{restaurant.name} order contact</strong><RestaurantContactDetails restaurant={restaurant} /></div>
    </div>
    <small className="public-footer__legal">Last updated {lastUpdated}. Platform and privacy enquiries are handled by {platformContact.name}; restaurant-specific order matters should also be directed to the restaurant where contact details are available.</small>
    {cookiesOpen && <CookiePreferencesDialog onClose={() => setCookiesOpen(false)} />}
  </footer>;
};

const PrivacyNotice = ({ restaurant }: { restaurant: RestaurantInfo }) => <article className="legal-copy">
  <h2>1. Scope and role</h2>
  <p>This Privacy Notice explains how this EmberServe POS deployment handles personal data when a visitor browses the menu, creates a pickup or table order, requests mobile verification, contacts support, or uses an authorised staff workspace. The restaurant remains responsible for its own food-service operations and the information it enters or receives through the service. Sneh Raunak is the platform and privacy contact for this deployment and can be contacted using the details below for questions about the application, this notice, or a data-rights request.</p>
  <h2>2. Information processed</h2>
  <p>Depending on how the service is used, we process the information needed to deliver that interaction: a customer name and mobile number; selected menu items, quantities, prices, table context, pickup details and voluntary kitchen notes; the mobile-verification outcome; staff account identifiers, assigned role and sign-in session details; and technical data such as device, browser, network, timestamp, request, error and security-event information. We do not ask customers to provide card or wallet credentials in this interface, and customers should never include payment data, passwords, government identifiers or unnecessary sensitive information in a kitchen note or an email.</p>
  <h2>3. Mobile verification and Firebase Authentication</h2>
  <p>When a customer chooses Send OTP in the live ordering flow, the mobile number is submitted to Firebase Authentication so that a one-time SMS verification code can be requested. Firebase uses a security check, including reCAPTCHA where applicable, to reduce automated abuse; Google states that phone numbers submitted for authentication may be sent to and stored by Google for spam and abuse prevention. The request is voluntary: a customer who does not wish to provide a number can stop before requesting a code, although the service may be unable to complete a protected order flow without verification. Test-mode numbers are fictional development credentials only and never generate a real SMS.</p>
  <h2>4. Why information is used</h2>
  <p>Information is used only for legitimate service purposes: presenting the menu; creating, validating and communicating about an order; identifying the relevant table or pickup request; authenticating customers and staff; preventing fraud, unauthorised access and service disruption; responding to support enquiries; meeting applicable record-keeping obligations; and improving reliability through aggregated operational diagnostics. Where consent is required, the service seeks it through the customer’s affirmative action, such as requesting a verification code or submitting information for an order. A customer may withdraw from an optional interaction at any time, subject to the fact that some data is necessary to provide the requested service.</p>
  <h2>5. Sharing and service providers</h2>
  <p>Personal data is not sold or rented. It may be disclosed only to the restaurant and its authorised personnel who need it to fulfil or manage an order, to hosting and infrastructure providers that operate the application and API, to Firebase Authentication and its security services for phone verification, to menu-image providers solely to render images, and to competent authorities or professional advisers where disclosure is required by law or reasonably necessary to establish, exercise or defend legal claims. Each recipient is expected to handle data only for the service purpose for which it is provided and subject to applicable contractual, technical or legal safeguards.</p>
  <h2>6. Retention and security</h2>
  <p>Information is retained only for as long as reasonably necessary for the order, account, operational audit, security, dispute-resolution and legal-record purposes for which it was collected, after which it is deleted, anonymised or securely restricted in accordance with the restaurant’s operating requirements and applicable law. Reasonable organisational and technical safeguards are used to limit access, protect session information and reduce unauthorised processing; however, no internet service can promise absolute security. Customers and staff should protect their devices, use only their own verification code, and report suspected misuse promptly.</p>
  <h2>7. Your choices and rights</h2>
  <p>You may ask for access to, correction of, deletion of, or information about the personal data associated with your use of this service, subject to identity verification and any lawful retention exception. You may also ask to withdraw consent for a future optional use, request assistance with a customer or staff account, or raise a concern about this notice. To help us locate the right record without collecting more information than necessary, include your name, the contact method used, the approximate date of the interaction and the nature of your request; do not send a password, OTP, payment credential or other sensitive information by email.</p>
  <h2>8. Updates and contact</h2>
  <p>We may update this notice when the service, its providers, or applicable obligations change. The effective date at the top of this page identifies the current version. For platform, privacy or data-rights questions, contact <strong>{platformContact.name}</strong> using the details below. For a restaurant-specific order question, the restaurant contact details shown below may provide the quickest resolution.</p>
  <PlatformContactDetails />
  <RestaurantContactDetails restaurant={restaurant} />
</article>;

const TermsOfUse = ({ restaurant }: { restaurant: RestaurantInfo }) => <article className="legal-copy">
  <h2>1. Acceptance and service purpose</h2>
  <p>These Terms of Use govern access to the EmberServe POS public menu, customer ordering flow, mobile-verification journey and authorised staff workspaces. By browsing the menu, submitting an order request, requesting a verification code or signing in to a staff area, you agree to use the service lawfully and in accordance with these Terms and the Privacy Notice. The service is a restaurant operations platform; it is not a marketplace, delivery guarantee, medical service or payment processor, and it should not be used for emergency communications.</p>
  <h2>2. Menu, orders and confirmation</h2>
  <p>Menu descriptions, availability, pricing, preparation times, table eligibility and totals are presented for convenience and may change before an order is accepted. An item displayed in the menu is not a binding promise that it remains available. Customers should review their selection, quantity, pickup or table context and any note before continuing. An order is subject to validation by the server and the restaurant’s operating workflow; the restaurant may need to decline, amend or contact the customer about an unavailable item, an apparent error, a duplicate request, an unsafe instruction or circumstances outside its reasonable control.</p>
  <h2>3. Dietary information and kitchen notes</h2>
  <p>Kitchen notes are transmitted to help the restaurant understand a request, but they are not a guarantee of allergen-free preparation, dietary suitability or cross-contamination control. Customers with an allergy, intolerance or other medical concern must contact the restaurant directly before relying on an item or placing an order. Do not use a kitchen note to submit highly sensitive personal information. The restaurant is responsible for its ingredients, preparation practices and any food-service advice it provides.</p>
  <h2>4. Mobile verification and secure use</h2>
  <p>Where mobile verification is enabled, a customer must provide a valid number, complete the applicable security check and enter the one-time code delivered by the authentication provider. Codes are personal, time-limited and must not be shared with another person, employee or third party. The security check protects customers and the service against automated misuse; attempting to bypass, automate or interfere with it is prohibited. A fictional Firebase test number can be used only in the separately designated development or preview test flow and cannot be used to obtain a real SMS for a personal number.</p>
  <h2>5. Payments, cancellation and fulfilment</h2>
  <p>This customer interface does not itself collect card or wallet details. If the restaurant offers a payment method, any payment is subject to the method, amount, timing, refund and cancellation information made available by the restaurant at the time of service. The restaurant controls preparation, fulfilment, handover, cancellations and any refund decision, subject to applicable law. A submitted order should not be treated as paid, confirmed, ready or served until the restaurant’s relevant workflow records that status.</p>
  <h2>6. Staff accounts and authorised access</h2>
  <p>Staff workspaces are limited to personnel authorised by the restaurant. Each user is responsible for safeguarding credentials and devices, following assigned role permissions and signing out of shared equipment. You must not share an account, attempt to access a role or record that is not assigned to you, alter requests outside the normal workflow, or use customer data for a personal purpose. The service may record security and operational actions to support access control, auditability, service continuity and investigation of suspected misuse.</p>
  <h2>7. Acceptable use, availability and limitations</h2>
  <p>You must not probe, scrape, reverse engineer, overload, circumvent security controls, submit fraudulent orders, impersonate another person, introduce malicious content, or interfere with another guest’s or restaurant’s use of the service. The service is provided on an availability basis and may be modified, suspended or restricted for maintenance, security, operational reasons or where misuse is suspected. To the maximum extent permitted by applicable law, neither the platform contact nor the restaurant is liable for indirect, incidental, special or consequential loss arising from a temporary interruption, an unauthorised act beyond reasonable control, a customer’s inaccurate submission, or a restaurant operational decision; this does not limit rights that cannot lawfully be excluded.</p>
  <h2>8. Changes, governing requirements and contact</h2>
  <p>These Terms may be revised when the service, restaurant operations, providers or applicable requirements change. Continued use after an updated effective date means you should review the revised Terms before continuing. Questions about a restaurant order should be directed to the restaurant where possible. Questions about the platform, these Terms, the Privacy Notice or a data request may be sent to <strong>{platformContact.name}</strong> using the details below.</p>
  <PlatformContactDetails />
  <RestaurantContactDetails restaurant={restaurant} />
</article>;

const ContactPage = ({ restaurant }: { restaurant: RestaurantInfo }) => <article className="legal-copy">
  <h2>Platform, privacy and data requests</h2>
  <p>For questions about EmberServe POS, this website, the Privacy Notice, the Terms of Use, a security concern, or a request to access, correct or delete personal information, contact the platform and privacy contact below. Please explain the purpose of your message and provide only the minimum information needed to identify the relevant interaction. To protect you, do not send passwords, one-time verification codes, payment credentials, identity documents or confidential restaurant data by email or text message.</p>
  <PlatformContactDetails />
  <h2>Restaurant order support</h2>
  <p>For an active order, food availability, pickup timing, table service, a kitchen note, cancellation or payment question, the restaurant is normally best placed to help. Use the restaurant contact details published below when available, and include the order reference and the time of the request. Platform support cannot manually issue, read or recover a one-time SMS code; verification codes are generated and validated by the configured authentication provider.</p>
  <RestaurantContactDetails restaurant={restaurant} />
  <h2>Response and escalation</h2>
  <p>Messages are reviewed in good faith and routed according to their nature. Security reports are prioritised, privacy requests may require reasonable identity verification, and restaurant fulfilment questions may need to be handled by the restaurant directly. If an issue cannot be resolved through the published contacts, you may use the contact details above to request a written acknowledgement and next steps. This contact page does not create an emergency support channel or a guarantee of immediate response.</p>
</article>;

const headings: Record<LegalKind, { eyebrow: string; title: string; description: string }> = {
  privacy: {
    eyebrow: "Privacy and data handling",
    title: "Privacy Notice",
    description: "Clear information about customer, order, session and phone-verification data processed by this deployment.",
  },
  terms: {
    eyebrow: "Using EmberServe POS",
    title: "Terms of Use",
    description: "The rules for customer ordering, mobile verification and authorised restaurant operations access.",
  },
  contact: {
    eyebrow: "Support and data requests",
    title: "Contact EmberServe POS",
    description: "Direct contact information for platform, privacy and restaurant-order support enquiries.",
  },
};

export const LegalPage = ({ kind }: { kind: LegalKind }) => {
  const { demoMode } = usePos();
  const restaurant = useRestaurantInfo(!demoMode);
  const heading = headings[kind];

  return <>
    <main className="legal-page">
      <div className="legal-page__heading">
        <span className="eyebrow"><ShieldCheck size={14} /> {heading.eyebrow}</span>
        <h1>{heading.title}</h1>
        <p>Effective and last updated {lastUpdated}. {heading.description} This information should be reviewed whenever the restaurant’s practices, providers or legal obligations change.</p>
      </div>
      {kind === "privacy" ? <PrivacyNotice restaurant={restaurant} /> : kind === "terms" ? <TermsOfUse restaurant={restaurant} /> : <ContactPage restaurant={restaurant} />}
    </main>
    <PublicFooter />
  </>;
};
