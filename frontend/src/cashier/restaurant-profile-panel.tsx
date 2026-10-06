import { Save, Settings2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { ApiError, api } from "@/shared/lib/api";
import type { PublicRestaurantInfo, RestaurantOpeningHour, ToastMessage } from "@/shared/types/domain";

const weekdays: RestaurantOpeningHour["day"][] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
type RestaurantProfileDraft = {
  name: string;
  tagline: string;
  description: string;
  phone: string;
  supportEmail: string;
  address: string;
  cuisine: string;
  story: string;
  chefName: string;
  chefRole: string;
  heroImageUrl: string;
  galleryImageUrls: string;
  bookingUrl: string;
  reservationEnabled: boolean;
  publicContactEnabled: boolean;
  openingHours: RestaurantOpeningHour[];
  parkingNote: string;
  accessibilityNote: string;
  instagramUrl: string;
};

const draftFromRestaurant = (restaurant?: PublicRestaurantInfo): RestaurantProfileDraft => {
  const profile = restaurant?.publicProfile;
  const byDay = new Map((profile?.openingHours ?? []).map((entry) => [entry.day, entry]));
  return {
    name: restaurant?.name ?? "",
    tagline: restaurant?.tagline ?? "",
    description: restaurant?.description ?? "",
    phone: restaurant?.phone ?? "",
    supportEmail: restaurant?.supportEmail ?? "",
    address: restaurant?.address ?? "",
    cuisine: profile?.cuisine ?? "",
    story: profile?.story ?? "",
    chefName: profile?.chefName ?? "",
    chefRole: profile?.chefRole ?? "",
    heroImageUrl: profile?.heroImageUrl ?? "",
    galleryImageUrls: (profile?.galleryImageUrls ?? []).join("\n"),
    bookingUrl: profile?.bookingUrl ?? "",
    reservationEnabled: profile?.reservationEnabled !== false,
    publicContactEnabled: profile?.publicContactEnabled === true,
    openingHours: weekdays.map((day) => byDay.get(day) ?? { day, closed: true, opens: "", closes: "" }),
    parkingNote: profile?.parkingNote ?? "",
    accessibilityNote: profile?.accessibilityNote ?? "",
    instagramUrl: profile?.instagramUrl ?? "",
  };
};

const asRestaurant = (value: unknown): PublicRestaurantInfo | undefined => {
  if (!value || typeof value !== "object" || typeof (value as { name?: unknown }).name !== "string") return undefined;
  return value as PublicRestaurantInfo;
};

export const RestaurantProfilePanel = ({ restaurant, demoMode, refreshMenu, notify }: { restaurant?: PublicRestaurantInfo; demoMode: boolean; refreshMenu: () => void; notify: (message: string, tone?: ToastMessage["tone"]) => void }) => {
  const [draft, setDraft] = useState<RestaurantProfileDraft>(() => draftFromRestaurant(restaurant));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(draftFromRestaurant(restaurant));
    if (demoMode) return;
    let active = true;
    void api.restaurant.getProfile().then((payload) => {
      const ownerRestaurant = asRestaurant(payload);
      if (active && ownerRestaurant) setDraft(draftFromRestaurant(ownerRestaurant));
    }).catch((error: unknown) => {
      if (active) notify(error instanceof ApiError ? error.message : "Restaurant profile could not be loaded.", "danger");
    });
    return () => { active = false; };
  }, [demoMode, notify, restaurant]);

  const updateHour = (day: RestaurantOpeningHour["day"], patch: Partial<RestaurantOpeningHour>) => setDraft((current) => ({ ...current, openingHours: current.openingHours.map((entry) => entry.day === day ? { ...entry, ...patch } : entry) }));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (demoMode) { notify("Preview mode is isolated. Sign in as a live cashier to update the restaurant profile.", "info"); return; }
    if (!draft.name.trim()) { notify("Restaurant name is required.", "danger"); return; }
    const openDayWithoutTimes = draft.openingHours.find((entry) => !entry.closed && (!entry.opens || !entry.closes));
    if (openDayWithoutTimes) { notify(`Set opening and closing times for ${openDayWithoutTimes.day}, or mark it closed.`, "danger"); return; }
    setSaving(true);
    void api.restaurant.updateProfile({
      name: draft.name.trim(),
      ...(draft.tagline.trim() ? { tagline: draft.tagline.trim() } : {}),
      ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
      ...(draft.phone.trim() ? { phone: draft.phone.trim() } : {}),
      supportEmail: draft.supportEmail.trim(),
      ...(draft.address.trim() ? { address: draft.address.trim() } : {}),
      publicProfile: {
        ...(draft.cuisine.trim() ? { cuisine: draft.cuisine.trim() } : {}),
        ...(draft.story.trim() ? { story: draft.story.trim() } : {}),
        ...(draft.chefName.trim() ? { chefName: draft.chefName.trim() } : {}),
        ...(draft.chefRole.trim() ? { chefRole: draft.chefRole.trim() } : {}),
        ...(draft.heroImageUrl.trim() ? { heroImageUrl: draft.heroImageUrl.trim() } : {}),
        galleryImageUrls: draft.galleryImageUrls.split("\n").map((value) => value.trim()).filter(Boolean),
        ...(draft.bookingUrl.trim() ? { bookingUrl: draft.bookingUrl.trim() } : {}),
        reservationEnabled: draft.reservationEnabled,
        publicContactEnabled: draft.publicContactEnabled,
        openingHours: draft.openingHours,
        ...(draft.parkingNote.trim() ? { parkingNote: draft.parkingNote.trim() } : {}),
        ...(draft.accessibilityNote.trim() ? { accessibilityNote: draft.accessibilityNote.trim() } : {}),
        ...(draft.instagramUrl.trim() ? { instagramUrl: draft.instagramUrl.trim() } : {}),
      }
    }).then(() => {
      refreshMenu();
      notify("Restaurant profile published to the guest experience.");
    }).catch((error: unknown) => notify(error instanceof ApiError ? error.message : "Restaurant profile could not be saved.", "danger"))
      .finally(() => setSaving(false));
  };

  return <section className="restaurant-profile-panel" aria-live="polite">
    <header><div><span className="eyebrow">Guest experience controls</span><h2>Restaurant profile & visit details</h2><p>Only publish verified restaurant-owned facts. This controls the public home, visit, reservation and footer experience.</p></div><Settings2 size={22} aria-hidden="true" /></header>
    <form className="catalogue-form restaurant-profile-form" onSubmit={submit}>
      <h3>Identity</h3><label>Restaurant name<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={150} /></label><label>Short promise<input value={draft.tagline} onChange={(event) => setDraft({ ...draft, tagline: event.target.value })} maxLength={200} placeholder="A table worth lingering over." /></label><label className="restaurant-profile-form__wide">Restaurant description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={1000} rows={3} placeholder="What should a first-time guest know?" /></label><label>Cuisine or concept<input value={draft.cuisine} onChange={(event) => setDraft({ ...draft, cuisine: event.target.value })} maxLength={120} placeholder="Modern Indian dining" /></label><label>Chef or host<input value={draft.chefName} onChange={(event) => setDraft({ ...draft, chefName: event.target.value })} maxLength={120} /></label><label>Role<input value={draft.chefRole} onChange={(event) => setDraft({ ...draft, chefRole: event.target.value })} maxLength={120} placeholder="Executive chef" /></label><label className="restaurant-profile-form__wide">Story<textarea value={draft.story} onChange={(event) => setDraft({ ...draft, story: event.target.value })} maxLength={2000} rows={5} placeholder="Your ingredients, people and point of view." /></label>
      <h3>Imagery & bookings</h3><label className="restaurant-profile-form__wide">Hero image URL<input type="url" value={draft.heroImageUrl} onChange={(event) => setDraft({ ...draft, heroImageUrl: event.target.value })} placeholder="Use a licensed, restaurant-owned image URL" /></label><label className="restaurant-profile-form__wide">Gallery image URLs <small>one per line, up to six</small><textarea value={draft.galleryImageUrls} onChange={(event) => setDraft({ ...draft, galleryImageUrls: event.target.value })} rows={4} placeholder="https://…" /></label><label>External booking URL <small>optional</small><input type="url" value={draft.bookingUrl} onChange={(event) => setDraft({ ...draft, bookingUrl: event.target.value })} placeholder="https://booking.example.com" /></label><label>Instagram URL <small>optional</small><input type="url" value={draft.instagramUrl} onChange={(event) => setDraft({ ...draft, instagramUrl: event.target.value })} placeholder="https://instagram.com/…" /></label><label className="catalogue-toggle restaurant-profile-form__wide"><input type="checkbox" checked={draft.reservationEnabled} onChange={(event) => setDraft({ ...draft, reservationEnabled: event.target.checked })} /> Accept reservation requests on this site</label>
      <h3>Visit details</h3><label>Guest phone<input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} maxLength={30} /></label><label>Guest email<input type="email" value={draft.supportEmail} onChange={(event) => setDraft({ ...draft, supportEmail: event.target.value })} maxLength={254} /></label><label className="restaurant-profile-form__wide">Address<textarea value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} maxLength={500} rows={2} /></label><label className="restaurant-profile-form__wide">Parking or arrival note<input value={draft.parkingNote} onChange={(event) => setDraft({ ...draft, parkingNote: event.target.value })} maxLength={500} /></label><label className="restaurant-profile-form__wide">Accessibility note<input value={draft.accessibilityNote} onChange={(event) => setDraft({ ...draft, accessibilityNote: event.target.value })} maxLength={500} /></label><label className="catalogue-toggle restaurant-profile-form__wide"><input type="checkbox" checked={draft.publicContactEnabled} onChange={(event) => setDraft({ ...draft, publicContactEnabled: event.target.checked })} /> Publish these guest contact details on the public site</label>
      <div className="restaurant-hours-editor restaurant-profile-form__wide"><h3>Opening hours</h3>{draft.openingHours.map((entry) => <div key={entry.day}><strong>{entry.day}</strong><label><span className="sr-only">Opening time</span><input type="time" value={entry.opens ?? ""} disabled={entry.closed} onChange={(event) => updateHour(entry.day, { opens: event.target.value })} /></label><span>to</span><label><span className="sr-only">Closing time</span><input type="time" value={entry.closes ?? ""} disabled={entry.closed} onChange={(event) => updateHour(entry.day, { closes: event.target.value })} /></label><label className="catalogue-toggle"><input type="checkbox" checked={entry.closed} onChange={(event) => updateHour(entry.day, { closed: event.target.checked })} /> Closed</label></div>)}</div>
      <div className="catalogue-form__actions restaurant-profile-form__wide"><button className="button button--saffron" disabled={saving} type="submit"><Save size={16} /> {saving ? "Publishing…" : "Publish restaurant profile"}</button></div>
    </form>
  </section>;
};
