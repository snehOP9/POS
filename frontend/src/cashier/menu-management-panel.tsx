import { Archive, ImagePlus, Minus, Plus, Save, Tags } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { FoodVisual } from "@/shared/components/food-visual";
import { api, ApiError } from "@/shared/lib/api";
import { formatMoney } from "@/shared/lib/format";
import type { MenuCategory, MenuItem, ToastMessage } from "@/shared/types/domain";

type ItemDraft = {
  id?: string;
  categoryId: string;
  name: string;
  description: string;
  imageUrl: string;
  basePrice: string;
  offerPercentage: string;
  offerLabel: string;
  foodType: "VEGETARIAN" | "NON_VEGETARIAN" | "VEGAN";
  station: "HOT" | "TANDOOR" | "COLD" | "BAR";
  preparationMinutes: string;
  available: boolean;
  featured: boolean;
};

const blankDraft = (categoryId = ""): ItemDraft => ({
  categoryId, name: "", description: "", imageUrl: "", basePrice: "", offerPercentage: "", offerLabel: "", foodType: "VEGETARIAN", station: "HOT", preparationMinutes: "15", available: true, featured: false,
});

const draftFromItem = (item: MenuItem): ItemDraft => ({
  id: item.id,
  categoryId: item.categoryId ?? "",
  name: item.name,
  description: item.description,
  imageUrl: item.imageUrl ?? "",
  basePrice: String(item.basePrice ?? item.price),
  offerPercentage: item.offer ? String(item.offer.percentage) : "",
  offerLabel: item.offer?.label ?? "",
  foodType: item.dietary === "vegan" ? "VEGAN" : item.dietary === "veg" ? "VEGETARIAN" : "NON_VEGETARIAN",
  station: item.station === "Tandoor" ? "TANDOOR" : item.station === "Cold" ? "COLD" : item.station === "Bar" ? "BAR" : "HOT",
  preparationMinutes: String(item.prepMinutes),
  available: !item.unavailable,
  featured: item.featured === true,
});

const errorMessage = (error: unknown, fallback: string) => error instanceof ApiError ? error.message : fallback;

export const MenuManagementPanel = ({
  items,
  categories,
  demoMode,
  refreshMenu,
  notify,
}: {
  items: MenuItem[];
  categories: MenuCategory[];
  demoMode: boolean;
  refreshMenu: () => void;
  notify: (message: string, tone?: ToastMessage["tone"]) => void;
}) => {
  const [draft, setDraft] = useState<ItemDraft>();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryImageUrl, setCategoryImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const groups = useMemo(() => categories.map((category) => ({ category, items: items.filter((item) => item.categoryId === category.id || item.category === category.name) })), [categories, items]);
  const firstCategoryId = categories[0]?.id ?? "";

  const run = async (work: () => Promise<unknown>, success: string, failure: string) => {
    if (demoMode) {
      notify("Preview mode is isolated. Sign in as a live cashier to change the catalogue.", "info");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await work();
      refreshMenu();
      notify(success);
    } catch (error) {
      notify(errorMessage(error, failure), "danger");
    } finally {
      setSaving(false);
    }
  };

  const submitCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(async () => api.menu.createCategory({
      name: categoryName.trim(),
      ...(categoryDescription.trim() ? { description: categoryDescription.trim() } : {}),
      ...(categoryImageUrl.trim() ? { imageUrl: categoryImageUrl.trim() } : {}),
      sortOrder: categories.length + 1,
      visible: true,
    }), "Category added and shared with active staff.", "Category could not be saved.").then(() => {
      setCategoryOpen(false); setCategoryName(""); setCategoryDescription(""); setCategoryImageUrl("");
    });
  };

  const submitItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    const price = Math.round(Number(draft.basePrice) * 100);
    const offerPercentage = Number(draft.offerPercentage);
    const payload = {
      categoryId: draft.categoryId,
      name: draft.name.trim(),
      description: draft.description.trim(),
      imageUrl: draft.imageUrl.trim(),
      basePricePaise: price,
      ...(offerPercentage > 0 ? { offer: { percentage: offerPercentage, label: draft.offerLabel.trim() || `${offerPercentage}% off` } } : draft.id ? { offer: null } : {}),
      foodType: draft.foodType,
      station: draft.station,
      preparationMinutes: Math.max(0, Math.round(Number(draft.preparationMinutes) || 0)),
      available: draft.available,
      featured: draft.featured,
      allergens: [],
      spiceLevel: 0,
      variants: [],
      modifierGroups: [],
    };
    if (!payload.categoryId || !payload.name || !payload.imageUrl || !Number.isFinite(price) || price < 0) {
      notify("Name, category, a valid price, and a licensed food image URL are required.", "danger");
      return;
    }
    void run(async () => draft.id ? api.menu.updateItem(draft.id, payload) : api.menu.createItem(payload), draft.id ? "Menu item updated for all live roles." : "Menu item added and shared with the kitchen flow.", "Menu item could not be saved.").then(() => setDraft(undefined));
  };

  const adjustPrice = (item: MenuItem, delta: number) => {
    const next = Math.max(0, Math.round(((item.basePrice ?? item.price) + delta) * 100));
    void run(() => api.menu.updateItem(item.id, { basePricePaise: next }), `${item.name} price updated.`, "Price could not be updated.");
  };

  return <section className="menu-management-panel" aria-live="polite">
    <header className="menu-management-panel__header">
      <div><span className="eyebrow">Live catalogue controls</span><h2>Menu, pricing & offers</h2><p>Changes publish to active cashiers, guests, and waiters immediately. Sent orders keep their original snapshots.</p></div>
      <div><button type="button" className="outline-button" onClick={() => { setCategoryOpen((open) => !open); setDraft(undefined); }}><Tags size={15} /> Add category</button><button type="button" className="button button--saffron" onClick={() => { setDraft(blankDraft(firstCategoryId)); setCategoryOpen(false); }} disabled={!firstCategoryId}><ImagePlus size={15} /> Add item</button></div>
    </header>
    {demoMode && <p className="menu-management-panel__preview">Preview mode shows the live workflow but deliberately cannot change the shared restaurant catalogue.</p>}
    {categoryOpen && <form className="catalogue-form catalogue-form--category" onSubmit={submitCategory}>
      <h3>New category</h3><label>Name<input required value={categoryName} onChange={(event) => setCategoryName(event.target.value)} maxLength={100} placeholder="Desserts" /></label><label>Description<input value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} maxLength={500} placeholder="A short menu description" /></label><label>Category image URL <input type="url" value={categoryImageUrl} onChange={(event) => setCategoryImageUrl(event.target.value)} placeholder="https://images.pexels.com/..." /></label><div className="catalogue-form__actions"><button className="quiet-button" type="button" onClick={() => setCategoryOpen(false)}>Cancel</button><button className="button button--saffron" disabled={saving} type="submit"><Save size={15} /> {saving ? "Saving…" : "Save category"}</button></div>
    </form>}
    {draft && <form className="catalogue-form" onSubmit={submitItem}>
      <div className="catalogue-form__heading"><div><span className="eyebrow">{draft.id ? "Edit item" : "New item"}</span><h3>{draft.id ? draft.name || "Menu item" : "Add a photographed dish"}</h3></div><button type="button" className="quiet-button" onClick={() => setDraft(undefined)}>Cancel</button></div>
      <label>Name<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={150} placeholder="Smoked mushroom kebab" /></label><label>Category<select required value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Description<input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={1000} placeholder="What guests can expect" /></label><label>Food image URL <input required type="url" value={draft.imageUrl} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} placeholder="Licensed Pexels or Unsplash image URL" /><small>Every new dish needs a licensed image URL so it is visible across the POS.</small></label>
      <label>Base price (₹)<input required type="number" min="0" step="1" value={draft.basePrice} onChange={(event) => setDraft({ ...draft, basePrice: event.target.value })} /></label><label>Offer % <input type="number" min="0" max="90" step="1" value={draft.offerPercentage} onChange={(event) => setDraft({ ...draft, offerPercentage: event.target.value })} placeholder="0" /></label><label>Offer label<input value={draft.offerLabel} onChange={(event) => setDraft({ ...draft, offerLabel: event.target.value })} maxLength={80} placeholder="Lunch special" /></label><label>Station<select value={draft.station} onChange={(event) => setDraft({ ...draft, station: event.target.value as ItemDraft["station"] })}><option value="HOT">Hot kitchen</option><option value="TANDOOR">Tandoor</option><option value="COLD">Cold kitchen</option><option value="BAR">Bar</option></select></label><label>Prep minutes<input type="number" min="0" max="240" value={draft.preparationMinutes} onChange={(event) => setDraft({ ...draft, preparationMinutes: event.target.value })} /></label><label>Diet<select value={draft.foodType} onChange={(event) => setDraft({ ...draft, foodType: event.target.value as ItemDraft["foodType"] })}><option value="VEGETARIAN">Vegetarian</option><option value="VEGAN">Vegan</option><option value="NON_VEGETARIAN">Non-vegetarian</option></select></label><label className="catalogue-toggle"><input type="checkbox" checked={draft.available} onChange={(event) => setDraft({ ...draft, available: event.target.checked })} /> Available to sell</label><label className="catalogue-toggle"><input type="checkbox" checked={draft.featured} onChange={(event) => setDraft({ ...draft, featured: event.target.checked })} /> Feature this item</label>
      <div className="catalogue-form__actions"><button className="button button--saffron" disabled={saving} type="submit"><Save size={15} /> {saving ? "Saving…" : draft.id ? "Save live changes" : "Add to live menu"}</button></div>
    </form>}
    <div className="catalogue-groups">{groups.map(({ category, items: categoryItems }) => <section key={category.id} className="catalogue-group"><header><div><h3>{category.name}</h3><small>{category.description || `${categoryItems.length} live menu items`}</small></div><b>{categoryItems.length}</b></header>{categoryItems.length ? categoryItems.map((item) => <article key={item.id} className="catalogue-item"><FoodVisual item={item} size="mini" /><div><strong>{item.name}</strong><small>{item.unavailable ? "Unavailable" : "Available"}{item.offer ? ` · ${item.offer.label}` : ""}</small><span>{item.basePrice && item.basePrice !== item.price ? <s>{formatMoney(item.basePrice)}</s> : null} <b>{formatMoney(item.price)}</b></span></div><div className="catalogue-item__controls"><button type="button" className="icon-button" title="Decrease base price by ₹25" aria-label={`Decrease ${item.name} price`} disabled={saving} onClick={() => adjustPrice(item, -25)}><Minus size={14} /></button><button type="button" className="icon-button" title="Increase base price by ₹25" aria-label={`Increase ${item.name} price`} disabled={saving} onClick={() => adjustPrice(item, 25)}><Plus size={14} /></button><button type="button" className="outline-button" onClick={() => setDraft(draftFromItem(item))}>Edit</button><button type="button" className={item.unavailable ? "outline-button" : "quiet-button quiet-button--danger"} disabled={saving} onClick={() => void run(() => api.menu.setAvailability(item.id, Boolean(item.unavailable)), item.unavailable ? `${item.name} is available again.` : `${item.name} is unavailable.`, "Availability could not be updated.")}>{item.unavailable ? "Enable" : "Disable"}</button><button type="button" className="icon-button catalogue-item__archive" aria-label={`Archive ${item.name}`} title="Archive item" disabled={saving} onClick={() => { if (window.confirm(`Archive ${item.name}? Existing orders will be preserved.`)) void run(() => api.menu.archiveItem(item.id), `${item.name} archived; prior orders remain intact.`, "Item could not be archived."); }}><Archive size={14} /></button></div></article>) : <p className="catalogue-group__empty">No items in this category yet.</p>}</section>)}</div>
  </section>;
};
