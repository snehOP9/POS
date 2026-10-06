import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, CalendarDays, ChefHat, Clock3, ExternalLink, MapPin, Menu, Phone, ShieldCheck, Sparkles, UtensilsCrossed, UsersRound, X } from "lucide-react";
import { Link } from "react-router-dom";

import { FoodVisual } from "@/shared/components/food-visual";
import { Brand } from "@/shared/components/brand";
import { ApiError, api, apiIsConfigured } from "@/shared/lib/api";
import { formatMoney } from "@/shared/lib/format";
import { usePos } from "@/shared/store/pos-store";
import type { PublicRestaurantInfo, Reservation, RestaurantOpeningHour } from "@/shared/types/domain";
import { PublicFooter } from "./public-pages";

const fallbackRestaurant: PublicRestaurantInfo = {
  name: "Ember & Grain",
  tagline: "A modern Indian table, made for lingering.",
  description: "Live-fire cooking, bright regional flavours and generous plates for the middle of the table.",
  publicProfile: { galleryImageUrls: [], openingHours: [], reservationEnabled: true, publicContactEnabled: false }
};

const defaultStory = "Ember & Grain is a contemporary Indian dining room shaped around the pleasure of sharing. We bring together live-fire cooking, bright regional flavours and the dishes that make the best kind of meal: the one everyone reaches for in the middle of the table.";
const defaultKitchenStory = "The menu moves between smoke, spice, acidity and comfort, with ingredients such as coconut, curry leaf, black pepper, kasundi and saffron doing the quiet work. It is food with contrast, made to be passed around and remembered.";

const isLegacyDemoProfile = (restaurant: PublicRestaurantInfo) =>
  restaurant.name === "EmberServe Demo Restaurant" || restaurant.description?.includes("production-shaped demonstration") === true;

const presentRestaurant = (restaurant: PublicRestaurantInfo): PublicRestaurantInfo => {
  if (!isLegacyDemoProfile(restaurant)) return restaurant;
  return {
    ...restaurant,
    name: fallbackRestaurant.name,
    tagline: fallbackRestaurant.tagline,
    description: fallbackRestaurant.description,
    publicProfile: { ...restaurant.publicProfile, galleryImageUrls: restaurant.publicProfile?.galleryImageUrls ?? [], reservationEnabled: restaurant.publicProfile?.reservationEnabled ?? true, publicContactEnabled: restaurant.publicProfile?.publicContactEnabled ?? false, openingHours: restaurant.publicProfile?.openingHours ?? [], cuisine: restaurant.publicProfile?.cuisine ?? "Contemporary Indian dining" }
  };
};

const dateTimeInputValue = () => {
  const value = new Date(Date.now() + 60 * 60 * 1000);
  value.setMinutes(Math.ceil(value.getMinutes() / 15) * 15, 0, 0);
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

const restaurantLabel = (restaurant: PublicRestaurantInfo) => restaurant.publicProfile?.cuisine ?? "Restaurant";

const useRestaurant = () => {
  const state = usePos();
  useEffect(() => {
    if (!state.restaurant && !state.menuLoading) state.refreshMenu();
  }, [state.menuLoading, state.refreshMenu, state.restaurant]);
  return { ...state, restaurant: presentRestaurant(state.restaurant ?? fallbackRestaurant) };
};

const todayHours = (hours: RestaurantOpeningHour[], timezone?: string) => {
  if (!hours.length) return "Hours will be confirmed with your booking.";
  const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: timezone || "Asia/Kolkata" }).format(new Date()) as RestaurantOpeningHour["day"];
  const today = hours.find((entry) => entry.day === weekday);
  if (!today || today.closed) return "Closed today";
  return today.opens && today.closes ? `Today · ${today.opens}–${today.closes}` : "Hours will be confirmed with your booking.";
};

const ReservationCta = ({ restaurant, className = "button button--saffron" }: { restaurant: PublicRestaurantInfo; className?: string }) => {
  const bookingUrl = restaurant.publicProfile?.bookingUrl;
  if (bookingUrl) return <a className={className} href={bookingUrl} target="_blank" rel="noreferrer">Book a table <ExternalLink size={17} /></a>;
  if (restaurant.publicProfile?.reservationEnabled === false) return <Link className={className} to="/visit">Plan your visit <ArrowRight size={17} /></Link>;
  return <Link className={className} to="/reservations">Book a table <ArrowRight size={17} /></Link>;
};

const RestaurantNavigationLinks = ({ onNavigate }: { onNavigate: () => void }) => <>
  <Link to="/" onClick={onNavigate}>Home</Link>
  <Link to="/menu" onClick={onNavigate}>Menu</Link>
  <Link to="/story" onClick={onNavigate}>Our story</Link>
  <Link to="/visit" onClick={onNavigate}>Visit</Link>
</>;

export const RestaurantHeader = ({ restaurant }: { restaurant: PublicRestaurantInfo }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return <header className="restaurant-header">
    <Brand name={restaurant.name} descriptor={restaurantLabel(restaurant)} />
    <nav className="restaurant-header__nav" aria-label="Restaurant navigation"><RestaurantNavigationLinks onNavigate={closeMenu} /></nav>
    <div className="restaurant-header__actions">
      <Link className="restaurant-header__staff" to="/access">Staff sign in</Link>
      <ReservationCta restaurant={restaurant} className="button button--saffron restaurant-header__booking" />
      <button className="restaurant-header__menu-toggle" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="restaurant-mobile-navigation" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={19} /> : <Menu size={20} />}</button>
    </div>
    {menuOpen && <nav id="restaurant-mobile-navigation" className="restaurant-header__mobile-menu" aria-label="Mobile restaurant navigation"><RestaurantNavigationLinks onNavigate={closeMenu} /><Link to="/access" onClick={closeMenu}>Staff sign in</Link></nav>}
  </header>;
};

const SignatureCard = ({ item }: { item: ReturnType<typeof useRestaurant>["menu"][number] }) => <Link className="restaurant-signature-card" to="/menu" aria-label={`View ${item.name} on the menu`}>
  <FoodVisual item={item} decorative />
  <span>{item.category}</span>
  <strong>{item.name}</strong>
  <small>{item.description}</small>
  <b>{formatMoney(item.price)}</b>
</Link>;

const VisitCard = ({ restaurant }: { restaurant: PublicRestaurantInfo }) => {
  const profile = restaurant.publicProfile;
  const hasAddress = Boolean(restaurant.address);
  const mapHref = restaurant.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}` : undefined;
  return <section className="restaurant-visit-card">
    <div><span className="eyebrow"><MapPin size={14} /> Plan your visit</span><h2>Everything you need before you arrive.</h2><p>{restaurant.address ?? "The restaurant address and directions will be published here once configured."}</p></div>
    <div className="restaurant-visit-card__details">
      <span><Clock3 size={17} /> {todayHours(profile?.openingHours ?? [], restaurant.timezone)}</span>
      {profile?.parkingNote && <span>{profile.parkingNote}</span>}
      {profile?.accessibilityNote && <span>{profile.accessibilityNote}</span>}
      {hasAddress && mapHref && <a href={mapHref} target="_blank" rel="noreferrer">Get directions <ExternalLink size={15} /></a>}
    </div>
  </section>;
};

export const RestaurantHomePage = () => {
  const { restaurant, menu, menuLoading } = useRestaurant();
  const profile = restaurant.publicProfile;
  const signatures = useMemo(() => menu.filter((item) => item.featured).slice(0, 3), [menu]);
  const gallery = profile?.galleryImageUrls ?? [];

  return <>
    <main className="restaurant-site">
      <RestaurantHeader restaurant={restaurant} />
      <section className="restaurant-hero">
        <div className="restaurant-hero__copy">
          <span className="hero-kicker"><Sparkles size={14} aria-hidden="true" /> {restaurantLabel(restaurant)}</span>
          <h1>{restaurant.tagline ?? "A table worth lingering over."}</h1>
          <p>{restaurant.description ?? "Seasonal cooking, gracious service and a meal made for the people around your table."}</p>
          <div className="restaurant-hero__actions"><ReservationCta restaurant={restaurant} /><Link className="outline-button" to="/menu">Explore the menu <ArrowRight size={17} /></Link></div>
          <div className="restaurant-hero__meta"><span><Clock3 size={16} /> {todayHours(profile?.openingHours ?? [], restaurant.timezone)}</span><span><ShieldCheck size={16} /> Dietary details are shown dish by dish</span></div>
        </div>
        <div className="restaurant-hero__visual" style={profile?.heroImageUrl ? { backgroundImage: `linear-gradient(120deg, rgba(38, 29, 18, .16), rgba(38, 29, 18, .48)), url(${profile.heroImageUrl})` } : undefined} aria-label={profile?.heroImageUrl ? `${restaurant.name} dining experience` : undefined}>
          {!profile?.heroImageUrl && <><i className="restaurant-hero__sun" /><i className="restaurant-hero__plate" /><i className="restaurant-hero__leaf restaurant-hero__leaf--one" /><i className="restaurant-hero__leaf restaurant-hero__leaf--two" /><span>SET THE TABLE<br />FOR SOMETHING<br />MEMORABLE</span></>}
        </div>
      </section>
      <section className="restaurant-intro-grid">
        <article><UtensilsCrossed size={22} /><strong>Cooked to order</strong><p>Every plate begins when the kitchen calls it, with live menu availability guiding the experience.</p></article>
        <article><CalendarDays size={22} /><strong>Thoughtful reservations</strong><p>Request a table online or follow the restaurant’s preferred booking route.</p></article>
        <article><UsersRound size={22} /><strong>For the whole table</strong><p>Tell the team about your occasion when booking so service can prepare with care.</p></article>
      </section>
      <section className="restaurant-signatures" aria-labelledby="signature-heading">
        <div className="restaurant-section-heading"><div><span className="eyebrow">From the kitchen</span><h2 id="signature-heading">A few reasons to gather.</h2></div><Link className="text-link" to="/menu">See the full menu <ArrowRight size={16} /></Link></div>
        {signatures.length ? <div className="restaurant-signature-grid">{signatures.map((item) => <SignatureCard key={item.id} item={item} />)}</div> : <div className="restaurant-loading-card">{menuLoading ? "Preparing today’s menu…" : "Today’s menu will appear here shortly."}</div>}
      </section>
      <section className="restaurant-story-teaser">
        <div><span className="eyebrow">Our point of view</span><h2>{profile?.chefName ? `Meet ${profile.chefName}.` : "Food with a sense of place."}</h2><p>{profile?.story ?? defaultStory}</p><Link className="outline-button" to="/story">Discover our story <ArrowRight size={17} /></Link></div>
        <div className="restaurant-gallery-preview">
          {gallery.slice(0, 3).map((image, index) => <img key={image} src={image} alt="Restaurant atmosphere" loading="lazy" className={`restaurant-gallery-preview__image restaurant-gallery-preview__image--${index + 1}`} />)}
          {!gallery.length && <div className="restaurant-gallery-preview__placeholder"><ChefHat size={34} /><span>Owner photography belongs here—not stock imagery.</span></div>}
        </div>
      </section>
      <VisitCard restaurant={restaurant} />
    </main>
    <PublicFooter />
  </>;
};

export const StoryPage = () => {
  const { restaurant } = useRestaurant();
  const profile = restaurant.publicProfile;
  return <><main className="restaurant-site restaurant-story-page"><RestaurantHeader restaurant={restaurant} />
    <section className="restaurant-page-heading"><span className="eyebrow">The restaurant</span><h1>More than a menu.</h1><p>{profile?.story ?? defaultStory}</p></section>
    <section className="restaurant-story-page__body"><article><span className="eyebrow">The kitchen</span><h2>{profile?.chefName ? `${profile.chefName}, ${profile.chefRole ?? "Kitchen lead"}` : "Made for the middle of the table."}</h2><p>{profile?.chefName ? "The restaurant’s culinary leadership is part of the guest experience, from seasonal menus to the last detail on the plate." : defaultKitchenStory}</p></article><article><span className="eyebrow">The table</span><h2>Seasonal, considered, generous.</h2><p>{restaurant.description ?? "The menu is always current, while the service promise stays simple: clear information, warm hospitality and food worth sharing."}</p></article></section>
    <VisitCard restaurant={restaurant} />
  </main><PublicFooter /></>;
};

export const VisitPage = () => {
  const { restaurant } = useRestaurant();
  const profile = restaurant.publicProfile;
  const hours = profile?.openingHours ?? [];
  const mapHref = restaurant.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}` : undefined;
  return <><main className="restaurant-site restaurant-visit-page"><RestaurantHeader restaurant={restaurant} />
    <section className="restaurant-page-heading"><span className="eyebrow">Visit {restaurant.name}</span><h1>Come hungry. Stay awhile.</h1><p>Find the practical details for your visit, then reserve a table when you are ready.</p></section>
    <section className="restaurant-visit-grid"><article><MapPin size={23} /><h2>Find us</h2><p>{restaurant.address ?? "The restaurant address has not been published yet."}</p>{mapHref && <a className="text-link" href={mapHref} target="_blank" rel="noreferrer">Get directions <ExternalLink size={16} /></a>}{profile?.parkingNote && <small>{profile.parkingNote}</small>}</article><article><Clock3 size={23} /><h2>Opening hours</h2>{hours.length ? <dl className="restaurant-hours">{hours.map((entry) => <div key={entry.day}><dt>{entry.day}</dt><dd>{entry.closed ? "Closed" : entry.opens && entry.closes ? `${entry.opens}–${entry.closes}` : "Please contact us"}</dd></div>)}</dl> : <p>Opening hours will be published by the restaurant shortly.</p>}</article><article><Phone size={23} /><h2>Contact</h2>{restaurant.phone || restaurant.supportEmail ? <address className="restaurant-contact">{restaurant.phone && <a href={`tel:${restaurant.phone.replace(/[^+\d]/g, "")}`}>{restaurant.phone}</a>}{restaurant.supportEmail && <a href={`mailto:${restaurant.supportEmail}`}>{restaurant.supportEmail}</a>}</address> : <p>The restaurant has not published a guest contact channel yet.</p>}{profile?.accessibilityNote && <small>{profile.accessibilityNote}</small>}</article></section>
    <section className="restaurant-visit-cta"><div><span className="eyebrow">Ready when you are</span><h2>Plan your table with confidence.</h2><p>Reservation requests are reviewed by the restaurant; availability is only confirmed when the team responds.</p></div><ReservationCta restaurant={restaurant} /></section>
  </main><PublicFooter /></>;
};

type ReservationForm = { guestName: string; guestEmail: string; guestPhone: string; partySize: string; reservationAt: string; occasion: string; notes: string; consent: boolean };
const initialReservation = (): ReservationForm => ({ guestName: "", guestEmail: "", guestPhone: "", partySize: "2", reservationAt: dateTimeInputValue(), occasion: "", notes: "", consent: false });

const asReservation = (payload: unknown): Reservation | undefined => {
  if (!payload || typeof payload !== "object") return undefined;
  const value = payload as Record<string, unknown>;
  return typeof value.id === "string" && typeof value.displayId === "string" ? value as unknown as Reservation : undefined;
};

export const ReservationPage = () => {
  const { restaurant } = useRestaurant();
  const [form, setForm] = useState<ReservationForm>(initialReservation);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [reservation, setReservation] = useState<Reservation>();
  const profile = restaurant.publicProfile;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    if (!form.guestEmail.trim() && !form.guestPhone.trim()) { setError("Share either an email address or phone number so the restaurant can respond."); return; }
    if (!apiIsConfigured) { setError("Reservations need the restaurant API to be configured before they can be sent."); return; }
    setSubmitting(true);
    void api.reservations.create({
      guestName: form.guestName.trim(),
      ...(form.guestEmail.trim() ? { guestEmail: form.guestEmail.trim() } : {}),
      ...(form.guestPhone.trim() ? { guestPhone: form.guestPhone.trim() } : {}),
      partySize: Number(form.partySize),
      reservationAt: new Date(form.reservationAt).toISOString(),
      ...(form.occasion.trim() ? { occasion: form.occasion.trim() } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      consent: true
    }).then((payload) => {
      const created = asReservation(payload);
      if (!created) throw new Error("The reservation response was incomplete.");
      setReservation(created);
    }).catch((reason: unknown) => setError(reason instanceof ApiError ? reason.message : "Your request could not be sent. Please try again."))
      .finally(() => setSubmitting(false));
  };

  if (profile?.bookingUrl) return <><main className="restaurant-site"><RestaurantHeader restaurant={restaurant} /><section className="restaurant-page-heading"><span className="eyebrow">Reservations</span><h1>Reserve your table.</h1><p>The restaurant uses a dedicated reservation partner for live availability.</p><ReservationCta restaurant={restaurant} /></section></main><PublicFooter /></>;
  if (profile?.reservationEnabled === false) return <><main className="restaurant-site"><RestaurantHeader restaurant={restaurant} /><section className="restaurant-page-heading"><span className="eyebrow">Reservations</span><h1>Reservations are currently offline.</h1><p>Please use the restaurant’s published contact channel for visit enquiries.</p><Link className="button button--saffron" to="/visit">Visit information <ArrowRight size={17} /></Link></section></main><PublicFooter /></>;
  return <><main className="restaurant-site restaurant-reservation-page"><RestaurantHeader restaurant={restaurant} /><section className="restaurant-page-heading"><span className="eyebrow">Reservations</span><h1>We’ll hold the table.</h1><p>Send a request and wait for the restaurant to confirm availability. A request is not a confirmed booking.</p></section>{reservation ? <section className="reservation-success"><ShieldCheck size={34} /><span className="eyebrow">Request received</span><h2>Your reference is {reservation.displayId}.</h2><p>The restaurant will confirm availability through the contact detail you provided. Your table is not confirmed until then.</p><Link className="outline-button" to="/menu">Explore the menu <ArrowRight size={17} /></Link></section> : <form className="reservation-form" onSubmit={submit}><label>Full name<input required value={form.guestName} onChange={(event) => setForm({ ...form, guestName: event.target.value })} maxLength={120} autoComplete="name" /></label><label>Email address<input type="email" value={form.guestEmail} onChange={(event) => setForm({ ...form, guestEmail: event.target.value })} maxLength={254} autoComplete="email" /></label><label>Phone number<input type="tel" value={form.guestPhone} onChange={(event) => setForm({ ...form, guestPhone: event.target.value })} maxLength={30} autoComplete="tel" /></label><label>Guests<select value={form.partySize} onChange={(event) => setForm({ ...form, partySize: event.target.value })}>{Array.from({ length: 12 }, (_, index) => index + 1).map((count) => <option value={count} key={count}>{count} {count === 1 ? "guest" : "guests"}</option>)}</select></label><label>Preferred date and time<input required type="datetime-local" min={dateTimeInputValue()} value={form.reservationAt} onChange={(event) => setForm({ ...form, reservationAt: event.target.value })} /></label><label>Occasion <span>optional</span><input value={form.occasion} onChange={(event) => setForm({ ...form, occasion: event.target.value })} maxLength={120} placeholder="Birthday, anniversary, business meal" /></label><label className="reservation-form__wide">A note for the team <span>optional</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} maxLength={500} placeholder="Please do not include medical or payment information." rows={4} /></label><label className="reservation-form__consent"><input required type="checkbox" checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} /> <span>I agree that the restaurant may use these details to respond to this reservation request, as described in the <Link to="/privacy">Privacy Notice</Link>.</span></label>{error && <p className="reservation-form__error" role="alert">{error}</p>}<div className="reservation-form__wide"><button className="button button--saffron" disabled={submitting} type="submit">{submitting ? "Sending request…" : "Request a table"} <ArrowRight size={17} /></button><small>Requests are subject to restaurant confirmation.</small></div></form>}</main><PublicFooter /></>;
};
