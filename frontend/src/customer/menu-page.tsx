import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Check, ChevronRight, Clock3, Flame, Heart, MapPin, Search, ShieldCheck, ShoppingBag, Sparkles, Star, UtensilsCrossed, X } from "lucide-react";
import { Brand } from "@/shared/components/brand";
import { CartDrawer } from "@/customer/cart-drawer";
import { FoodVisual } from "@/shared/components/food-visual";
import { QuantityControl } from "@/shared/components/quantity-control";
import { StatusPill } from "@/shared/components/status-pill";
import { ConnectionBadge } from "@/shared/components/connection-badge";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";
import { requiresConfiguration } from "@/shared/components/item-configurator";
import { formatMoney } from "@/shared/lib/format";
import { usePos } from "@/shared/store/pos-store";
import { selectionForOption, unitPriceForSelection } from "@/shared/lib/cart";
import type { MenuItem, Order, OrderStatus } from "@/shared/types/domain";
import { isActiveOrder } from "@/shared/lib/order-state";
import { Link, useLocation } from "react-router-dom";
import { PublicFooter } from "@/public/public-pages";

const spiceLabel = (level = 0) => level >= 3 ? "Hot" : level === 2 ? "Medium" : "Mild";

const MenuCard = ({ item, onCustomize }: { item: MenuItem; onCustomize: (item: MenuItem) => void }) => {
  const { cart, addToCart, updateLineQuantity } = usePos();
  const configurable = requiresConfiguration(item);
  const line = cart.find((candidate) => candidate.item.id === item.id && !candidate.modifiers?.length);
  return (
    <article className={`menu-card ${item.unavailable ? "menu-card--unavailable" : ""}`}>
      <button className="menu-card__visual-button" type="button" onClick={() => onCustomize(item)} aria-label={`Customize ${item.name}`}>
        <FoodVisual item={item} decorative />
        {item.featured && <span className="featured-ribbon"><Star size={12} fill="currentColor" /> Signature</span>}
        {item.unavailable && <span className="sold-out">Sold out</span>}
      </button>
      <div className="menu-card__content">
        <div className="menu-card__meta"><span className={`dietary-dot dietary-dot--${item.dietary}`} role="img" aria-label={item.dietary} /> <span>{item.category}</span>{item.heat ? <span className={`heat heat--${item.heat}`}>{spiceLabel(item.heat)} heat</span> : null}</div>
        <button className="text-button menu-card__title" type="button" onClick={() => onCustomize(item)}>{item.name}</button>
        <p>{item.description}</p>
        {item.allergens?.length ? <small className="menu-card__allergens">Contains: {item.allergens.join(", ")}</small> : null}
        <div className="menu-card__bottom"><strong>{formatMoney(item.price)}</strong>{line ? <QuantityControl quantity={line.quantity} onChange={(adjustment) => updateLineQuantity(line.id, adjustment)} compact /> : <button type="button" className="add-button" onClick={() => configurable ? onCustomize(item) : addToCart(item)} disabled={item.unavailable}>{configurable ? "Customize" : "Add"} <span>+</span></button>}</div>
      </div>
    </article>
  );
};

const MenuSkeleton = () => <div className="menu-grid menu-grid--skeleton" aria-busy="true" aria-label="Loading menu dishes">
  {Array.from({ length: 8 }, (_, index) => <article className="menu-card menu-card--skeleton" key={index} aria-hidden="true">
    <div className="menu-skeleton menu-skeleton--image" />
    <div className="menu-card__content"><i className="menu-skeleton menu-skeleton--meta" /><i className="menu-skeleton menu-skeleton--title" /><i className="menu-skeleton menu-skeleton--copy" /><i className="menu-skeleton menu-skeleton--action" /></div>
  </article>)}
</div>;

const DishDialog = ({ item, onClose }: { item: MenuItem; onClose: () => void }) => {
  const { addToCart } = usePos();
  const dialogRef = useDialogFocus(true, onClose);
  const [variantId, setVariantId] = useState(() => item.variants?.find((variant) => variant.available)?.id);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const variant = item.variants?.find((entry) => entry.id === variantId && entry.available);
  const modifiers = (item.modifierGroups ?? []).flatMap((group) => group.options
    .filter((option) => selectedOptionIds.includes(option.id))
    .map((option) => selectionForOption(group, option)));
  const selectionCount = (groupId: string) => modifiers.filter((modifier) => modifier.groupId === groupId).length;
  const toggleOption = (group: NonNullable<MenuItem["modifierGroups"]>[number], optionId: string) => setSelectedOptionIds((current) => {
    const selected = current.includes(optionId);
    if (!selected && current.filter((id) => group.options.some((option) => option.id === id)).length >= group.maxSelections) return current;
    return selected ? current.filter((id) => id !== optionId) : [...current, optionId];
  });
  const missingRequiredSelection = (item.modifierGroups ?? []).some((group) => selectionCount(group.id) < group.minSelections);
  const total = unitPriceForSelection(item, { variant, modifiers });

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="dish-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="dish-dialog-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="icon-button dish-dialog__close" onClick={onClose} aria-label="Close dish options"><X /></button>
        <FoodVisual item={item} size="feature" />
        <div className="dish-dialog__details"><div className="eyebrow">Made for your table</div><h2 id="dish-dialog-title">{item.name}</h2><p>{item.description}</p><strong>{formatMoney(total)}</strong></div>
        {item.variants?.length ? <fieldset className="option-group"><legend>Choose a portion</legend><div className="choice-row">{item.variants.map((option) => <label className={variantId === option.id ? "choice choice--selected" : "choice"} key={option.id}><input type="radio" name={`variant-${item.id}`} checked={variantId === option.id} disabled={!option.available} onChange={() => setVariantId(option.id)} />{option.name}{option.priceDelta ? ` ? ${option.priceDelta > 0 ? "+" : ""}${formatMoney(option.priceDelta)}` : ""}</label>)}</div></fieldset> : null}
        {(item.modifierGroups ?? []).map((group) => <fieldset className="option-group" key={group.id}><legend>{group.name}{group.minSelections ? ` choose at least ${group.minSelections}` : " optional"}</legend><div className="choice-stack">{group.options.map((option) => { const selected = selectedOptionIds.includes(option.id); const groupFull = selectionCount(group.id) >= group.maxSelections; return <label className="checkbox-choice" key={option.id}><input type="checkbox" checked={selected} disabled={!option.available || (!selected && groupFull)} onChange={() => toggleOption(group, option.id)} /><span>{option.name}{option.priceDelta ? ` ${option.priceDelta > 0 ? "+" : ""}${formatMoney(option.priceDelta)}` : ""}</span></label>; })}</div></fieldset>)}
        <p className="dish-dialog__allergen"><strong>Allergen notice:</strong> kitchen notes are not a guarantee of an allergen-free meal. Contact the restaurant directly before ordering if an allergy is life-threatening.</p>
        <label className="dish-note"><span>Kitchen note <small>optional</small></span><input value={note} onChange={(event) => setNote(event.target.value)} maxLength={280} placeholder="No onion, serve together, or a non-medical preference." /></label>
        <button type="button" className="button button--saffron button--full" disabled={missingRequiredSelection} onClick={() => { addToCart(item, { variant, modifiers, note }); onClose(); }}><ShoppingBag size={18} /> {missingRequiredSelection ? "Choose required options" : `Add to tray - ${formatMoney(total)}`}</button>
      </section>
    </div>
  );
};

const orderStage = (status: OrderStatus) => {
  if (["READY", "SERVED", "COMPLETED"].includes(status)) return 2;
  if (["PREPARING", "PARTIALLY_READY"].includes(status)) return 1;
  return 0;
};

const orderStages = [
  ["Order received", "Your order has reached our team."],
  ["On the fire", "The kitchen is preparing your dishes."],
  ["Ready to collect", "We will have it ready for hand-off."],
] as const;

const OrderTimeline = ({ order }: { order: Order }) => {
  const currentStage = orderStage(order.status);
  const cancelled = ["CANCELLED", "REJECTED"].includes(order.status);
  return <section className="order-timeline" aria-label={`Live status for ${order.displayId}`} aria-live="polite">
    <header><div><span className="eyebrow">Live order journey</span><h2>{order.displayId} is {order.status.toLowerCase().replaceAll("_", " ")}</h2></div><StatusPill status={order.status} /></header>
    {cancelled ? <p className="order-timeline__exception">This order needs a restaurant update. Please contact the team if you need help.</p> : <ol>{orderStages.map(([title, detail], index) => <li className={index <= currentStage ? "is-complete" : ""} key={title}><span aria-hidden="true">{index < currentStage ? <Check size={13} /> : index + 1}</span><div><strong>{title}</strong><small>{index === currentStage ? detail : index < currentStage ? "Complete" : "Up next"}</small></div></li>)}</ol>}
    <footer><span>Updated live</span><time dateTime={order.createdAt}>Ordered {new Date(order.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></footer>
  </section>;
};

const PickupCelebration = ({ name, onTrack, onDismiss }: { name: string; onTrack: () => void; onDismiss: () => void }) => <aside className="pickup-celebration" role="status" aria-live="assertive">
  <div className="pickup-celebration__sparks" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ "--spark": index } as CSSProperties} />)}</div>
  <div className="pickup-celebration__flame" aria-hidden="true"><Flame size={29} /></div>
  <div><span className="eyebrow">Name confirmed</span><strong>{name}, the kitchen is fired up.</strong><p>Your live order journey is ready whenever you are.</p></div>
  <div className="pickup-celebration__actions"><button type="button" className="button button--saffron" onClick={onTrack}>Track it <ChevronRight size={16} /></button><button type="button" className="quiet-button" onClick={onDismiss}>Dismiss</button></div>
</aside>;

export const MenuPage = () => {
  const { cart, setCartOpen, placeOrder, cartMode, setCartMode, orders, menu: items, menuLoading, menuError, refreshMenu, demoMode, notify, restaurant } = usePos();
  const location = useLocation();
  const tableToken = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return query.get("tableToken") || query.get("table") || query.get("token") || undefined;
  }, [location.search]);
  const dineInAvailable = demoMode || Boolean(tableToken);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [dietaryFilter, setDietaryFilter] = useState<"all" | "vegetarian" | "vegan">("all");
  const [showSignatures, setShowSignatures] = useState(false);
  const [spicyOnly, setSpicyOnly] = useState(false);
  const [excludedAllergen, setExcludedAllergen] = useState("");
  const [menuLimit, setMenuLimit] = useState(12);
  const [selectedDish, setSelectedDish] = useState<MenuItem>();
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [celebrationName, setCelebrationName] = useState<string>();
  useEffect(() => {
    refreshMenu();
  }, [refreshMenu]);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      document.querySelector<HTMLInputElement>(".menu-toolbar .search-field input")?.focus();
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    if (!dineInAvailable && cartMode === "DINE_IN") setCartMode("PICKUP");
  }, [cartMode, dineInAvailable, setCartMode]);

  useEffect(() => {
    if (!celebrationName) return;
    const timer = window.setTimeout(() => setCelebrationName(undefined), 9_000);
    return () => window.clearTimeout(timer);
  }, [celebrationName]);

  const visibleItems = useMemo(() => items.filter((item) => {
    const matchesCategory = activeCategory === "All" || item.category === activeCategory;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${item.name} ${item.description} ${item.tags.join(" ")}`.toLowerCase().includes(query);
    const matchesDiet = dietaryFilter === "all" ? true : dietaryFilter === "vegetarian" ? item.dietary !== "non-veg" : item.dietary === "vegan";
    const matchesAllergen = !excludedAllergen || !(item.allergens ?? []).map((allergen) => allergen.toLowerCase()).includes(excludedAllergen.toLowerCase());
    return matchesCategory && matchesSearch && matchesDiet && matchesAllergen && (!showSignatures || item.featured) && (!spicyOnly || Boolean(item.heat));
  }), [activeCategory, dietaryFilter, excludedAllergen, items, search, showSignatures, spicyOnly]);
  const displayedItems = visibleItems.slice(0, menuLimit);
  const featured = items.filter((item) => item.featured).slice(0, 4);
  const activeCategories = useMemo(() => ["All", ...Array.from(new Set(items.map((item) => item.category))).sort((left, right) => left.localeCompare(right))], [items]);
  const latestOrder = orders.find((order) => isActiveOrder(order.status));
  useEffect(() => {
    setMenuLimit(12);
  }, [activeCategory, dietaryFilter, excludedAllergen, search, showSignatures, spicyOnly]);
  useEffect(() => {
    const progress = document.querySelector<HTMLElement>(".order-progress");
    if (!progress || !latestOrder) return;
    const value = latestOrder.status === "SERVED" ? 3 : latestOrder.status === "READY" ? 2 : 1;
    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", "3");
    progress.setAttribute("aria-valuenow", String(value));
  }, [latestOrder?.status]);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const knownAllergens = useMemo(() => [...new Set(items.flatMap((item) => item.allergens ?? []).map((allergen) => allergen.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right)), [items]);

  return <><main className="customer-page">
    <header className="customer-nav"><Brand name={restaurant?.name ?? "Ember & Grain"} descriptor={restaurant?.publicProfile?.cuisine ?? "Restaurant"} /><nav aria-label="Customer navigation"><Link to="/">Home</Link><a href="#menu-list">Menu</a><Link to="/visit">Visit</Link>{restaurant?.publicProfile?.reservationEnabled !== false && <Link to="/reservations">Reservations</Link>}{latestOrder && <a href="#tracking" onClick={() => setTrackingOpen(true)}>Order status</a>}</nav><div className="customer-nav__actions"><ConnectionBadge live={demoMode ? "preview" : "guest"} /><Link className="customer-access-link" to="/access">Staff sign in</Link><button type="button" className="cart-button" onClick={() => setCartOpen(true)} aria-label={`Open cart, ${count} items`}><ShoppingBag size={18} /><span>{count || "Cart"}</span>{count > 0 && <b>{count}</b>}</button></div></header>

    <section className="menu-hero">
      <div className="menu-hero__copy"><span className="hero-kicker"><span>A brighter kind of dining</span><Sparkles size={14} aria-hidden="true" /></span><h1>Bold flavours,<br /><em>served slow enough</em><br />to remember.</h1><p>Seasonal Indian plates, grilled over flame and brought to your table with care.</p><a className="button button--charcoal" href="#menu-list">Explore today’s menu <ChevronRight size={17} /></a><div className="hero-context"><span><MapPin size={16} /> {dineInAvailable ? "Table ordering is available for this visit" : "Pickup ordering is available"}</span><span><Clock3 size={16} /> Availability is confirmed at checkout</span></div></div>
      <div className="menu-hero__art" aria-hidden="true"><div className="hero-sun" /><div className="hero-smoke hero-smoke--one" /><div className="hero-smoke hero-smoke--two" /><div className="hero-bowl"><span>✦</span></div><div className="hero-leaf hero-leaf--one" /><div className="hero-leaf hero-leaf--two" /><p>EMBER<br />&amp; GRAIN</p></div>
    </section>

    {latestOrder && <section className="tracking-strip" id="tracking"><div className="tracking-strip__main"><span className="tracking-orb"><Flame size={20} /></span><div><span className="eyebrow">Your kitchen update</span><strong>{latestOrder.displayId} · {latestOrder.tableLabel}</strong></div></div><StatusPill status={latestOrder.status} /><div className="order-progress" aria-label={`Order ${latestOrder.status.toLowerCase()}`}><span className="is-complete" /><span className={latestOrder.status === "READY" || latestOrder.status === "SERVED" ? "is-complete" : ""} /><span className={latestOrder.status === "SERVED" ? "is-complete" : ""} /></div><button type="button" className="quiet-button" aria-expanded={trackingOpen} aria-controls="order-timeline" onClick={() => setTrackingOpen((open) => !open)}>{trackingOpen ? "Hide tracking" : "Track order"} <ChevronRight size={16} /></button>{trackingOpen && <div id="order-timeline" className="tracking-strip__timeline"><OrderTimeline order={latestOrder} /></div>}</section>}

    <section className="featured-section"><div className="section-heading"><div><span className="eyebrow">Chef’s spark</span><h2>Worth gathering around</h2></div><button type="button" className="signature-link" onClick={() => { setSearch(""); setActiveCategory("All"); setDietaryFilter("all"); setExcludedAllergen(""); setSpicyOnly(false); setShowSignatures(true); document.getElementById("menu-list")?.scrollIntoView({ behavior: "smooth", block: "start" }); notify("Showing our signature dishes.", "info"); }}>See all signatures <ChevronRight size={16} /></button></div><div className="featured-rail">{featured.map((item) => <button className={`feature-card feature-card--${item.color}`} type="button" key={item.id} onClick={() => setSelectedDish(item)}><FoodVisual item={item} size="feature" decorative /><span className="feature-card__label">{item.tags[0] ?? "House special"}</span><div><strong>{item.name}</strong><span>{formatMoney(item.price)} · {item.prepMinutes} min</span></div></button>)}</div></section>

    <section className="menu-section" id="menu-list"><div className="section-heading section-heading--menu"><div><span className="section-kicker">Everyday menu</span><div className="menu-heading-row"><h2>Choose your own delicious</h2><span className="menu-source" role="status">{demoMode ? "Preview menu" : menuLoading ? "Refreshing live menu" : "Live menu"}</span></div></div></div><div className="menu-toolbar"><label className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search a dish or ingredient" aria-label="Search menu" /><kbd>⌘ K</kbd></label><output className="menu-result-count" aria-live="polite">{visibleItems.length} {visibleItems.length === 1 ? "dish" : "dishes"}</output></div><div className="menu-refinements"><nav className="category-rail" aria-label="Menu categories">{activeCategories.map((category) => <button type="button" key={category} className={activeCategory === category ? "category-chip category-chip--active" : "category-chip"} onClick={() => setActiveCategory(category)}>{category}</button>)}</nav><div className="menu-filter-controls"><button type="button" className={dietaryFilter === "vegetarian" ? "filter-chip filter-chip--active" : "filter-chip"} aria-pressed={dietaryFilter === "vegetarian"} onClick={() => setDietaryFilter((current) => current === "vegetarian" ? "all" : "vegetarian")}><span className="dietary-dot dietary-dot--veg" aria-hidden="true" /> Vegetarian</button><button type="button" className={dietaryFilter === "vegan" ? "filter-chip filter-chip--active" : "filter-chip"} aria-pressed={dietaryFilter === "vegan"} onClick={() => setDietaryFilter((current) => current === "vegan" ? "all" : "vegan")}>Vegan</button><button type="button" className={showSignatures ? "filter-chip filter-chip--active" : "filter-chip"} aria-pressed={showSignatures} onClick={() => setShowSignatures((current) => !current)}><Star size={14} aria-hidden="true" /> Signatures</button><button type="button" className={spicyOnly ? "filter-chip filter-chip--active" : "filter-chip"} aria-pressed={spicyOnly} onClick={() => setSpicyOnly((current) => !current)}><Flame size={14} aria-hidden="true" /> Spicy</button>{knownAllergens.length ? <label className="allergen-filter">Avoid <select value={excludedAllergen} onChange={(event) => setExcludedAllergen(event.target.value)}><option value="">Choose an allergen</option>{knownAllergens.map((allergen) => <option key={allergen} value={allergen}>{allergen}</option>)}</select></label> : null}</div></div><p className="menu-allergen-notice"><ShieldCheck size={16} /> Allergen information is shown when configured. Kitchen notes cannot guarantee an allergen-free meal; contact the restaurant for serious allergies.</p>{menuLoading && !items.length ? <MenuSkeleton /> : <><div className="menu-grid">{displayedItems.map((item) => <MenuCard key={item.id} item={item} onCustomize={setSelectedDish} />)}</div>{visibleItems.length > displayedItems.length && <button type="button" className="menu-load-more" onClick={() => setMenuLimit((current) => current + 12)}>Show 12 more dishes <ChevronRight size={17} /></button>}</>}{!menuLoading && !visibleItems.length && <div className="empty-state menu-empty"><UtensilsCrossed size={34} /><strong>{menuError ?? "No plates match that search."}</strong><span>{menuError ? "Check the connection or try again in a moment." : "Try another ingredient or clear a filter."}</span><button type="button" className="menu-reset-button" onClick={() => { if (menuError) refreshMenu(); setSearch(""); setActiveCategory("All"); setDietaryFilter("all"); setExcludedAllergen(""); setShowSignatures(false); setSpicyOnly(false); }}>{menuError ? "Retry menu" : "Reset menu"}</button></div>}</section>

    <section className="dining-note"><div className="dining-note__star"><Heart fill="currentColor" size={23} /></div><div><span className="eyebrow">A note from our kitchen</span><h2>We cook each order to the moment it’s called.</h2><p>For preferences, use a kitchen note. For a severe allergy, please contact the restaurant directly before you order.</p></div><div className="dining-mode"><span>How are you dining?</span><div>{(["DINE_IN", "PICKUP"] as const).map((mode) => <button key={mode} type="button" className={cartMode === mode ? "mode-pill mode-pill--active" : "mode-pill"} aria-pressed={cartMode === mode} disabled={mode === "DINE_IN" && !dineInAvailable} onClick={() => setCartMode(mode)}>{mode === "DINE_IN" ? "At my table" : "I’ll pick up"}</button>)}</div>{!dineInAvailable && <small>Scan your table QR code to order at your table.</small>}</div></section>

    {count > 0 && <button className="mobile-cart-bar" type="button" onClick={() => setCartOpen(true)}><ShoppingBag size={19} /><span>{count} {count === 1 ? "item" : "items"}</span><strong>View tray</strong></button>}
    <CartDrawer
      checkoutLabel={cartMode === "DINE_IN" ? "Review table order" : "Review pickup order"}
      orderMode={cartMode === "DINE_IN" ? "DINE_IN" : "PICKUP"}
      onCheckout={async (pickup) => {
        const placed = await placeOrder("customer", "UNPAID", undefined, pickup, undefined, tableToken);
        if (placed && pickup?.name) setCelebrationName(pickup.name);
        return placed;
      }}
    />
    {selectedDish && <DishDialog item={selectedDish} onClose={() => setSelectedDish(undefined)} />}
  </main>{celebrationName && <PickupCelebration name={celebrationName} onDismiss={() => setCelebrationName(undefined)} onTrack={() => { setCelebrationName(undefined); setTrackingOpen(true); window.setTimeout(() => document.getElementById("tracking")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0); }} />}<PublicFooter /></>;
};
