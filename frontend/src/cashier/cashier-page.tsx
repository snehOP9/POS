import { useEffect, useMemo, useState } from "react";
import { BarChart3, Bell, Check, ChevronDown, CircleHelp, Clock3, LayoutGrid, LockKeyhole, MenuSquare, MoreHorizontal, Plus, ReceiptText, Search, Settings2, ShoppingBasket, Table2, UtensilsCrossed, WalletCards } from "lucide-react";
import { Brand } from "@/shared/components/brand";
import { ConnectionBadge } from "@/shared/components/connection-badge";
import { FoodVisual } from "@/shared/components/food-visual";
import { QuantityControl } from "@/shared/components/quantity-control";
import { StatusPill } from "@/shared/components/status-pill";
import { useLiveUpdates } from "@/shared/hooks/useLiveUpdates";
import { formatClock, formatMoney } from "@/shared/lib/format";
import { useClock } from "@/shared/hooks/useClock";
import { usePos } from "@/shared/store/pos-store";
import { cartLineLabels, cartLineTotal } from "@/shared/lib/cart";
import type { DiningMode } from "@/shared/types/domain";

const navItems = [
  [LayoutGrid, "POS", true], [Table2, "Tables"], [ReceiptText, "Orders"], [WalletCards, "Payments"], [Clock3, "Shift"], [MenuSquare, "Menu"], [BarChart3, "Reports"], [Settings2, "Settings"],
] as const;

export const CashierPage = () => {
  const {
    cart, cartSubtotal, cartTax, cartService, cartTotal, addToCart, updateLineQuantity,
    clearCart, cartMode, setCartMode, tables, selectedTableId, selectTable, placeOrder, orders, menu, demoMode, isMutating, refreshOperations,
  } = usePos();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Pay later">("Cash");
  const [cashTendered, setCashTendered] = useState("");
  const now = useClock(30_000);
  const live = useLiveUpdates(refreshOperations);
  useEffect(() => {
    if (!demoMode && cartMode === "DINE_IN" && !tables.length) setCartMode("COUNTER");
  }, [cartMode, demoMode, setCartMode, tables.length]);
  const selectedTable = tables.find((table) => table.id === selectedTableId);
  const cashierCategories = ["All", ...new Set(menu.map((item) => item.category))];
  const filteredItems = useMemo(() => menu.filter((item) => {
    const needle = search.toLowerCase().trim();
    return (activeCategory === "All" || item.category === activeCategory) && (!needle || `${item.name} ${item.description}`.toLowerCase().includes(needle));
  }), [activeCategory, menu, search]);
  const tender = Number(cashTendered) || 0;
  const change = Math.max(0, tender - cartTotal);
  const activeOrders = orders.filter((order) => order.status !== "COMPLETED").length;

  const checkout = () => {
    placeOrder("cashier", paymentMethod === "Cash" ? "PAID" : "UNPAID", paymentMethod === "Cash" ? Math.round(tender * 100) : undefined);
    setCashTendered("");
  };

  return <main className="cashier-page">
    <aside className="cashier-sidebar"><Brand inverse /><nav aria-label="Cashier navigation">{navItems.map(([Icon, label, active]) => <button type="button" key={label} className={active ? "cashier-nav-item cashier-nav-item--active" : "cashier-nav-item"}><Icon size={19} /><span>{label}</span>{label === "Orders" && activeOrders > 0 && <b>{activeOrders}</b>}</button>)}</nav><div className="cashier-sidebar__footer"><button type="button" className="cashier-profile"><span>MC</span><div><strong>Maya Chen</strong><small>Cashier · Evening</small></div><MoreHorizontal size={18} /></button><button type="button" className="lock-button"><LockKeyhole size={17} /> Lock register</button></div></aside>
    <section className="cashier-workspace">
      <header className="cashier-header"><div><span className="eyebrow">Register 01 · Evening shift</span><h1>New order <span>#{1086 + orders.length}</span></h1></div><div className="cashier-header__tools"><span className="cashier-time">{formatClock(new Date(now))}</span><ConnectionBadge live={live} /><button type="button" className="icon-button" aria-label="Notifications"><Bell size={19} /><b className="notification-dot" /></button><button type="button" className="icon-button" aria-label="Help"><CircleHelp size={19} /></button></div></header>
      <div className="cashier-body">
        <section className="cashier-products"><div className="cashier-products__top"><label className="search-field search-field--operational"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search menu, SKU or item" /><kbd>F2</kbd></label><span className="outline-button" aria-live="polite"><ShoppingBasket size={17} /> Open orders <b>{activeOrders}</b></span></div><div className="cashier-categories">{cashierCategories.map((category) => <button type="button" key={category} className={category === activeCategory ? "cashier-category cashier-category--active" : "cashier-category"} onClick={() => setActiveCategory(category)}>{category}</button>)}</div><div className="cashier-grid">{filteredItems.map((item) => <button type="button" className="cashier-product" key={item.id} onClick={() => addToCart(item)} disabled={item.unavailable}><FoodVisual item={item} size="mini" /><div><span className={`dietary-dot dietary-dot--${item.dietary}`} /><strong>{item.name}</strong><small>{item.unavailable ? "Unavailable" : `${item.prepMinutes} min`}</small></div><b>{formatMoney(item.price)}</b><span className="cashier-product__add"><Plus size={16} /></span></button>)}</div>{!filteredItems.length && <div className="empty-state"><UtensilsCrossed size={30} /><strong>No live menu items are available.</strong><span>Menu data appears here after the API responds.</span></div>}</section>
        <aside className="pos-bill"><div className="pos-bill__top"><div><span className="eyebrow">Live bill</span><h2>{cart.length ? `${cart.length} menu selections` : "Start a fresh bill"}</h2></div><button type="button" className="quiet-button quiet-button--danger" onClick={clearCart} disabled={!cart.length || isMutating}>Clear</button></div><div className="order-mode-row">{(["DINE_IN", "PICKUP", "COUNTER"] as DiningMode[]).map((mode) => <button key={mode} type="button" className={cartMode === mode ? "order-mode order-mode--active" : "order-mode"} onClick={() => setCartMode(mode)}>{mode === "DINE_IN" ? "Dine in" : mode === "PICKUP" ? "Pickup" : "Counter"}</button>)}</div>{cartMode === "DINE_IN" && tables.length > 0 && <label className="table-selector"><Table2 size={17} /><span>Serving</span><select value={selectedTableId} onChange={(event) => selectTable(event.target.value)}>{tables.map((table) => <option key={table.id} value={table.id}>{table.label} · {table.guests || "new"} guests</option>)}</select><ChevronDown size={16} /></label>}
          <div className="pos-bill__lines">{cart.length ? cart.map((line) => <article className="pos-line" key={line.id}><div className={`pos-line__dot swatch--${line.item.color}`} /><div><strong>{line.item.name}</strong><span>{cartLineLabels(line).join(" / ") || "Standard preparation"}</span><b>{formatMoney(cartLineTotal(line))}</b></div><QuantityControl quantity={line.quantity} onChange={(changeQuantity) => updateLineQuantity(line.id, changeQuantity)} compact /></article>) : <div className="empty-state pos-empty"><UtensilsCrossed size={31} /><strong>Tap a menu item to build the order.</strong><span>Totals and payment stay visible here.</span></div>}</div>
          <div className="pos-bill__totals"><dl className="order-totals"><div><dt>Items</dt><dd>{formatMoney(cartSubtotal)}</dd></div><div><dt>Tax · 5%</dt><dd>{formatMoney(cartTax)}</dd></div>{cartService > 0 && <div><dt>Service · 5%</dt><dd>{formatMoney(cartService)}</dd></div>}<div className="order-totals__total"><dt>Total due</dt><dd>{formatMoney(cartTotal)}</dd></div></dl></div>
          <div className="payment-section"><div className="payment-section__heading"><span>Settlement</span><StatusPill status={cart.length ? "UNPAID" : "DRAFT"} subtle /></div><div className="payment-methods">{(["Cash", "Pay later"] as const).map((method) => <button type="button" key={method} className={paymentMethod === method ? "payment-method payment-method--selected" : "payment-method"} onClick={() => setPaymentMethod(method)}>{method === "Cash" ? "Cash" : <Clock3 size={17} />}<span>{method}</span>{paymentMethod === method && <Check size={15} />}</button>)}</div>{paymentMethod === "Cash" && <div className="cash-input"><label htmlFor="cash-tendered">Cash received</label><div><span>INR</span><input id="cash-tendered" inputMode="numeric" value={cashTendered} onChange={(event) => setCashTendered(event.target.value.replace(/[^0-9]/g, ""))} placeholder="0" /></div>{tender > 0 && <small>Change to return: <b>{formatMoney(change)}</b></small>}</div>}</div>
          <button type="button" className="button button--saffron button--full pos-pay-button" onClick={checkout} disabled={isMutating || !cart.length || (paymentMethod === "Cash" && tender < cartTotal)}><span>{isMutating ? "Saving securely..." : paymentMethod === "Cash" ? "Settle cash and send" : "Send to kitchen - unpaid"}</span><strong>{formatMoney(cartTotal)}</strong></button><p className="pos-bill__footnote">{cartMode === "DINE_IN" && selectedTable ? `${selectedTable.label} / ${selectedTable.zone}` : "Walk-in order"} / Server calculates final price</p>
        </aside>
      </div>
    </section>
  </main>;
};
