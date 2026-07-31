import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Clock3, Flame, Heart, MapPin, Search, ShoppingBag, Sparkles, Star, UtensilsCrossed, X } from "lucide-react";
import { Brand } from "@/shared/components/brand";
import { CartDrawer } from "@/customer/cart-drawer";
import { ConnectionBadge } from "@/shared/components/connection-badge";
import { FoodVisual } from "@/shared/components/food-visual";
import { QuantityControl } from "@/shared/components/quantity-control";
import { StatusPill } from "@/shared/components/status-pill";
import { restaurant } from "@/shared/data/demo";
import { useLiveUpdates } from "@/shared/hooks/useLiveUpdates";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";
import { formatMoney } from "@/shared/lib/format";
import { usePos } from "@/shared/store/pos-store";
import type { MenuItem } from "@/shared/types/domain";
import { useNavigate } from "react-router-dom";

const heat = (level = 0) => "●".repeat(level);

const MenuCard = ({ item, onCustomize }: { item: MenuItem; onCustomize: (item: MenuItem) => void }) => {
  const { cart, addToCart, updateLineQuantity } = usePos();
  const line = cart.find((candidate) => candidate.item.id === item.id && !candidate.modifiers?.length);
  return (
    <article className={`menu-card ${item.unavailable ? "menu-card--unavailable" : ""}`}>
      <button className="menu-card__visual-button" type="button" onClick={() => onCustomize(item)} aria-label={`Customize ${item.name}`}>
        <FoodVisual item={item} />
        {item.featured && <span className="featured-ribbon"><Star size={12} fill="currentColor" /> Signature</span>}
        {item.unavailable && <span className="sold-out">Sold out</span>}
      </button>
      <div className="menu-card__content">
        <div className="menu-card__meta"><span className={`dietary-dot dietary-dot--${item.dietary}`} aria-label={item.dietary} /> <span>{item.category}</span>{item.heat ? <span className="heat">{heat(item.heat)}</span> : null}</div>
        <button className="text-button menu-card__title" type="button" onClick={() => onCustomize(item)}>{item.name}</button>
        <p>{item.description}</p>
        <div className="menu-card__bottom"><strong>{formatMoney(item.price)}</strong>{line ? <QuantityControl quantity={line.quantity} onChange={(adjustment) => updateLineQuantity(line.id, adjustment)} compact /> : <button type="button" className="add-button" onClick={() => addToCart(item)} disabled={item.unavailable}>Add <span>+</span></button>}</div>
      </div>
    </article>
  );
};

const DishDialog = ({ item, onClose }: { item: MenuItem; onClose: () => void }) => {
  const { addToCart } = usePos();
  const dialogRef = useDialogFocus(true, onClose);
  const [spice, setSpice] = useState("Kitchen standard");
  const [extras, setExtras] = useState<string[]>([]);
  const toggleExtra = (extra: string) => setExtras((current) => current.includes(extra) ? current.filter((value) => value !== extra) : [...current, extra]);
  const modifiers = [spice, ...extras].filter((value) => value !== "Kitchen standard");
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="dish-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="dish-dialog-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="icon-button dish-dialog__close" onClick={onClose} aria-label="Close dish options"><X /></button>
        <FoodVisual item={item} size="feature" />
        <div className="dish-dialog__details"><div className="eyebrow">Made for your table</div><h2 id="dish-dialog-title">{item.name}</h2><p>{item.description}</p><strong>{formatMoney(item.price)}</strong></div>
        <fieldset className="option-group"><legend>Heat preference</legend><div className="choice-row">{["Mild", "Kitchen standard", "Extra chilli"].map((choice) => <label className={spice === choice ? "choice choice--selected" : "choice"} key={choice}><input type="radio" name="spice" checked={spice === choice} onChange={() => setSpice(choice)} />{choice}</label>)}</div></fieldset>
        <fieldset className="option-group"><legend>Finish it your way</legend><div className="choice-stack">{["Add herb salad + ₹65", "Extra house chutney + ₹35"].map((extra) => <label className="checkbox-choice" key={extra}><input type="checkbox" checked={extras.includes(extra)} onChange={() => toggleExtra(extra)} /><span>{extra}</span></label>)}</div></fieldset>
        <button type="button" className="button button--saffron button--full" onClick={() => { addToCart(item, modifiers); onClose(); }}><ShoppingBag size={18} /> Add to tray · {formatMoney(item.price)}</button>
      </section>
    </div>
  );
};

export const MenuPage = () => {
  const { cart, setCartOpen, placeOrder, cartMode, setCartMode, orders, menu: items, menuLoading, menuError, refreshMenu, refreshOperations, demoMode, session } = usePos();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [vegetarian, setVegetarian] = useState(false);
  const [selectedDish, setSelectedDish] = useState<MenuItem>();
  const live = useLiveUpdates(refreshOperations);

  useEffect(() => {
    if (!demoMode && cartMode === "DINE_IN") setCartMode("PICKUP");
  }, [cartMode, demoMode, setCartMode]);

  const visibleItems = useMemo(() => items.filter((item) => {
    const matchesCategory = activeCategory === "All" || item.category === activeCategory;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${item.name} ${item.description} ${item.tags.join(" ")}`.toLowerCase().includes(query);
    return matchesCategory && matchesSearch && (!vegetarian || item.dietary !== "non-veg");
  }), [activeCategory, items, search, vegetarian]);
  const featured = items.filter((item) => item.featured).slice(0, 4);
  const activeCategories = ["All", ...new Set(items.map((item) => item.category))];
  const latestOrder = orders.find((order) => order.status !== "COMPLETED");
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);

  return <main className="customer-page">
    <header className="customer-nav"><Brand /><nav aria-label="Customer navigation"><a href="#menu-list">Menu</a><a href="#tracking">Order status</a><a href="/login">Sign in</a></nav><div className="customer-nav__actions"><ConnectionBadge live={live} /><button type="button" className="cart-button" onClick={() => setCartOpen(true)} aria-label={`Open cart, ${count} items`}><ShoppingBag size={18} /><span>{count || "Cart"}</span>{count > 0 && <b>{count}</b>}</button></div></header>

    <section className="menu-hero">
      <div className="menu-hero__copy"><span className="eyebrow eyebrow--saffron"><Sparkles size={14} /> A brighter kind of dining</span><h1>Bold flavours,<br /><em>served slow enough</em><br />to remember.</h1><p>Seasonal Indian plates, grilled over flame and brought to your table with care.</p><div className="hero-context"><span><MapPin size={16} /> {restaurant.tableContext}</span><span><Clock3 size={16} /> Kitchen opens until 11:30 PM</span></div><a className="button button--charcoal" href="#menu-list">Explore today’s menu <ChevronRight size={17} /></a></div>
      <div className="menu-hero__art" aria-hidden="true"><div className="hero-sun" /><div className="hero-smoke hero-smoke--one" /><div className="hero-smoke hero-smoke--two" /><div className="hero-bowl"><span>✦</span></div><div className="hero-leaf hero-leaf--one" /><div className="hero-leaf hero-leaf--two" /><p>EMBER<br />&amp; GRAIN</p></div>
    </section>

    {latestOrder && <section className="tracking-strip" id="tracking"><div className="tracking-strip__main"><span className="tracking-orb"><Flame size={20} /></span><div><span className="eyebrow">Your kitchen update</span><strong>{latestOrder.displayId} · {latestOrder.tableLabel}</strong></div></div><StatusPill status={latestOrder.status} /><div className="order-progress" aria-label={`Order ${latestOrder.status.toLowerCase()}`}><span className="is-complete" /><span className={latestOrder.status === "READY" || latestOrder.status === "SERVED" ? "is-complete" : ""} /><span className={latestOrder.status === "SERVED" ? "is-complete" : ""} /></div><button type="button" className="quiet-button">Track order <ChevronRight size={16} /></button></section>}

    <section className="featured-section"><div className="section-heading"><div><span className="eyebrow">Chef’s spark</span><h2>Worth gathering around</h2></div><button type="button" className="text-link">See all signatures <ChevronRight size={16} /></button></div><div className="featured-rail">{featured.map((item) => <button className={`feature-card feature-card--${item.color}`} type="button" key={item.id} onClick={() => setSelectedDish(item)}><FoodVisual item={item} size="feature" /><span className="feature-card__label">{item.tags[0] ?? "House special"}</span><div><strong>{item.name}</strong><span>{formatMoney(item.price)} · {item.prepMinutes} min</span></div></button>)}</div></section>

    <section className="menu-section" id="menu-list"><div className="section-heading"><div><span className="eyebrow">The everyday menu</span><h2>Choose your own delicious</h2></div><span className="menu-source">{demoMode ? "Preview menu" : menuLoading ? "Loading live menu" : "Live menu"}</span></div><div className="menu-toolbar"><label className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search a dish or ingredient" aria-label="Search menu" /><kbd>⌘ K</kbd></label><label className="veg-switch"><input type="checkbox" checked={vegetarian} onChange={(event) => setVegetarian(event.target.checked)} /><span className="dietary-dot dietary-dot--veg" /> Vegetarian</label></div><div className="category-rail" aria-label="Menu categories">{activeCategories.map((category) => <button type="button" key={category} className={activeCategory === category ? "category-chip category-chip--active" : "category-chip"} onClick={() => setActiveCategory(category)}>{category}</button>)}</div><div className="menu-grid">{visibleItems.map((item) => <MenuCard key={item.id} item={item} onCustomize={setSelectedDish} />)}</div>{!visibleItems.length && <div className="empty-state menu-empty"><UtensilsCrossed size={34} /><strong>{menuLoading ? "The kitchen is loading today’s menu." : menuError ?? "No plates match that search."}</strong><span>{menuError ? "Check the connection or try again in a moment." : "Try another ingredient or clear a filter."}</span><button type="button" className="quiet-button" onClick={() => { if (menuError) refreshMenu(); setSearch(""); setActiveCategory("All"); setVegetarian(false); }}>{menuError ? "Retry menu" : "Reset menu"}</button></div>}</section>

    <section className="dining-note"><div className="dining-note__star"><Heart fill="currentColor" size={23} /></div><div><span className="eyebrow">A note from our kitchen</span><h2>We cook each order to the moment it’s called.</h2><p>Please let us know about allergies — the team will see your note before the fire starts.</p></div><div className="dining-mode"><span>How are you dining?</span><div>{(["DINE_IN", "PICKUP"] as const).map((mode) => <button key={mode} type="button" className={cartMode === mode ? "mode-pill mode-pill--active" : "mode-pill"} onClick={() => setCartMode(mode)}>{mode === "DINE_IN" ? "At my table" : "I’ll pick up"}</button>)}</div></div></section>

    {count > 0 && <button className="mobile-cart-bar" type="button" onClick={() => setCartOpen(true)}><ShoppingBag size={19} /><span>{count} {count === 1 ? "item" : "items"}</span><strong>View tray</strong></button>}
    <CartDrawer checkoutLabel={cartMode === "DINE_IN" ? "Send to kitchen" : "Place pickup order"} onCheckout={() => { if (!session || session.role !== "CUSTOMER") { navigate("/login", { state: { from: "/menu" } }); return; } placeOrder("customer"); }} />
    {selectedDish && <DishDialog item={selectedDish} onClose={() => setSelectedDish(undefined)} />}
  </main>;
};
