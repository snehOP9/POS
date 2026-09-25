import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Bell, Check, ChevronDown, CircleHelp, Clock3, LayoutGrid, LockKeyhole, MenuSquare, Minus, MoreHorizontal, Plus, ReceiptText, Search, Settings2, ShoppingBasket, Table2, UtensilsCrossed, WalletCards } from "lucide-react";
import { Brand } from "@/shared/components/brand";
import { ConnectionBadge } from "@/shared/components/connection-badge";
import { FoodVisual } from "@/shared/components/food-visual";
import { QuantityControl } from "@/shared/components/quantity-control";
import { StatusPill } from "@/shared/components/status-pill";
import { useLiveUpdates } from "@/shared/hooks/useLiveUpdates";
import { formatClock, formatMoney } from "@/shared/lib/format";
import { ApiError, api } from "@/shared/lib/api";
import { useClock } from "@/shared/hooks/useClock";
import { usePos } from "@/shared/store/pos-store";
import { cartLineLabels, cartLineTotal } from "@/shared/lib/cart";
import type { DiningMode } from "@/shared/types/domain";

const navItems = [
  [LayoutGrid, "POS", true], [Table2, "Tables"], [ReceiptText, "Orders"], [WalletCards, "Payments"], [Clock3, "Shift"], [MenuSquare, "Menu"], [BarChart3, "Reports"], [Settings2, "Settings"],
] as const;

type ReportSummary = {
  from: string;
  to: string;
  orderCount: number;
  totalSales: number;
  paid: number;
  refunded: number;
  averageOrder: number;
  byMode: Record<string, number>;
  byProvider: Record<string, number>;
};

const reportRange = () => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: new Date().toISOString() };
};
export const CashierPage = () => {
  const {
    cart, cartSubtotal, cartTax, cartService, cartTotal, addToCart, updateLineQuantity,
    clearCart, cartMode, setCartMode, tables, selectedTableId, selectTable, adjustGuests, placeOrder, orders, menu, demoMode, isMutating, refreshOperations, notify, logout,
  } = usePos();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Pay later">("Cash");
  const [cashTendered, setCashTendered] = useState("");
  const [activeNav, setActiveNav] = useState("POS");
  const [dineInTableSelected, setDineInTableSelected] = useState(false);
  const [dineInGuestDraft, setDineInGuestDraft] = useState(1);
  const [report, setReport] = useState<ReportSummary>();
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string>();
  const navigate = useNavigate();
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

  const hasActiveDineInSession = dineInTableSelected && Boolean(selectedTable && selectedTable.guests > 0);
  const dineInGuestCount = dineInTableSelected ? (hasActiveDineInSession ? selectedTable?.guests ?? 0 : dineInGuestDraft) : 0;
  const dineInDetailsIncomplete = cartMode === "DINE_IN" && (!dineInTableSelected || dineInGuestCount < 1);
  const checkout = () => {
    if (dineInDetailsIncomplete) { notify("Choose a table, then set the guest count before sending a dine-in order.", "danger"); return; }
    placeOrder("cashier", paymentMethod === "Cash" ? "PAID" : "UNPAID", paymentMethod === "Cash" ? Math.round(tender * 100) : undefined, undefined, dineInGuestCount);
    setCashTendered("");
  };

  const loadReports = () => {
    const range = reportRange();
    setReportLoading(true);
    setReportError(undefined);
    if (demoMode) {
      const included = orders.filter((order) => !["CANCELLED", "REJECTED"].includes(order.status));
      const totalSales = included.reduce((total, order) => total + order.total, 0);
      const paid = included.filter((order) => order.paymentStatus === "PAID").reduce((total, order) => total + order.total, 0);
      const byMode = included.reduce<Record<string, number>>((result, order) => ({ ...result, [order.mode]: (result[order.mode] ?? 0) + order.total }), {});
      setReport({ from: range.from, to: range.to, orderCount: included.length, totalSales, paid, refunded: 0, averageOrder: included.length ? totalSales / included.length : 0, byMode, byProvider: paid ? { Cash: paid } : {} });
      setReportLoading(false);
      return;
    }
    void api.reports.summary(range.from, range.to).then((payload) => {
      setReport(payload as ReportSummary);
    }).catch((error: unknown) => {
      setReportError(error instanceof ApiError ? error.message : "The sales report is unavailable.");
    }).finally(() => setReportLoading(false));
  };
  const openCashierSection = (label: string) => {
    setActiveNav(label);
    if (label === "POS" || label === "Menu") {
      document.querySelector(".cashier-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (label === "Menu") document.querySelector<HTMLInputElement>(".cashier-products .search-field input")?.focus();
      return;
    }
    if (label === "Orders" || label === "Payments") return;
    if (label === "Reports") {
      loadReports();
      return;
    }
    if (label === "Payments") {
      notify(`${orders.filter((order) => order.paymentStatus !== "PAID").length} orders still need payment attention.`, "info");
      return;
    }
    notify(`${label} is selected. Operational controls stay available in the live bill.`, "info");
  };
  const lockRegister = () => { logout(); navigate("/login"); };

  return <main className="cashier-page">
    <aside className="cashier-sidebar"><Brand inverse /><nav aria-label="Cashier navigation">{navItems.map(([Icon, label]) => <button type="button" key={label} className={activeNav === label ? "cashier-nav-item cashier-nav-item--active" : "cashier-nav-item"} aria-current={activeNav === label ? "page" : undefined} onClick={() => openCashierSection(label)}><Icon size={19} /><span>{label}</span>{label === "Orders" && activeOrders > 0 && <b>{activeOrders}</b>}</button>)}</nav><div className="cashier-sidebar__footer"><button type="button" className="cashier-profile" onClick={() => notify("Maya Chen, Cashier, evening shift.", "info")}><span>MC</span><div><strong>Maya Chen</strong><small>Cashier · Evening</small></div><MoreHorizontal size={18} /></button><button type="button" className="lock-button" onClick={lockRegister}><LockKeyhole size={17} /> Lock register</button></div></aside>
    <section className="cashier-workspace">
      <header className="cashier-header"><div><span className="eyebrow">Register 01 · Evening shift</span><h1>New order <span>#{1086 + orders.length}</span></h1></div><div className="cashier-header__tools"><span className="cashier-time">{formatClock(new Date(now))}</span><ConnectionBadge live={live} /><button type="button" className="icon-button" aria-label="Notifications" onClick={() => notify(activeOrders ? `${activeOrders} open orders need attention.` : "No new cashier alerts.", "info")}><Bell size={19} /><b className="notification-dot" /></button><button type="button" className="icon-button" aria-label="Help" onClick={() => notify("Search, add items, choose settlement, then send the order to kitchen.", "info")}><CircleHelp size={19} /></button></div></header>
      {["Tables", "Orders", "Payments"].includes(activeNav) && <section className="cashier-operations-panel" aria-live="polite"><header><div><span className="eyebrow">Register operations</span><h2>{activeNav}</h2></div><button type="button" className="outline-button" onClick={() => setActiveNav("POS")}>Back to POS</button></header>{activeNav === "Tables" && <div className="operations-table-grid">{tables.map((table) => <button type="button" key={table.id} onClick={() => { selectTable(table.id); setDineInTableSelected(true); setDineInGuestDraft(Math.max(1, table.guests || 1)); setCartMode("DINE_IN"); document.querySelector(".table-selector")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}><span><b>{table.label}</b><small>{table.zone}</small></span><span><b>{table.guests ? `${table.guests}/${table.seats} guests` : `${table.seats} seats`}</b><small>{table.status}</small></span></button>)}</div>}{activeNav === "Orders" && <div className="operations-list">{orders.length ? orders.map((order) => <article key={order.id}><div><strong>{order.displayId} · {order.tableLabel}</strong><small>{order.status.replace("_", " ")} · {order.items.length} items</small></div><b>{formatMoney(order.total)}</b></article>) : <p>No orders are available for this register.</p>}</div>}{activeNav === "Payments" && <div className="operations-list">{orders.filter((order) => order.paymentStatus !== "PAID" && order.paymentStatus !== "REFUNDED").length ? orders.filter((order) => order.paymentStatus !== "PAID" && order.paymentStatus !== "REFUNDED").map((order) => <article key={order.id}><div><strong>{order.displayId} · {order.tableLabel}</strong><small>{order.paymentStatus.replace("_", " ")}</small></div><b>{formatMoney(order.total)}</b></article>) : <p>All visible orders are settled.</p>}</div>}</section>}{activeNav === "Reports" && <section className="cashier-report-panel" aria-live="polite"><header><div><span className="eyebrow">Sales reporting</span><h2>Today’s register summary</h2></div><button type="button" className="outline-button" onClick={loadReports} disabled={reportLoading}>{reportLoading ? "Refreshing…" : "Refresh"}</button></header>{reportError && <div className="report-message report-message--error">{reportError}</div>}{reportLoading && !report && <div className="report-message">Loading report…</div>}{report && <><div className="report-metrics"><article><span>Sales</span><strong>{formatMoney(report.totalSales)}</strong><small>{report.orderCount} orders</small></article><article><span>Collected</span><strong>{formatMoney(report.paid)}</strong><small>Settled payments</small></article><article><span>Average order</span><strong>{formatMoney(report.averageOrder)}</strong><small>Before refunds</small></article><article><span>Refunded</span><strong>{formatMoney(report.refunded)}</strong><small>In this period</small></article></div><div className="report-breakdowns"><section><h3>Sales by channel</h3>{Object.entries(report.byMode).length ? Object.entries(report.byMode).map(([mode, amount]) => <div key={mode}><span>{mode.replace("_", " ")}</span><b>{formatMoney(amount)}</b></div>) : <p>No completed sales in this period.</p>}</section><section><h3>Payments by provider</h3>{Object.entries(report.byProvider).length ? Object.entries(report.byProvider).map(([provider, amount]) => <div key={provider}><span>{provider}</span><b>{formatMoney(amount)}</b></div>) : <p>No settled payments in this period.</p>}</section></div><small className="report-window">{demoMode ? "Preview calculation from the current demo data." : `Live period: ${new Date(report.from).toLocaleString()} – ${new Date(report.to).toLocaleString()}.`}</small></>}</section>}<div className="cashier-body">
        <section className="cashier-products" id="cashier-products"><div className="cashier-products__top"><label className="search-field search-field--operational"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search menu, SKU or item" /><kbd>F2</kbd></label><button type="button" className="outline-button" aria-live="polite" onClick={() => openCashierSection("Orders")}><ShoppingBasket size={17} /> Open orders <b>{activeOrders}</b></button></div><div className="cashier-categories">{cashierCategories.map((category) => <button type="button" key={category} className={category === activeCategory ? "cashier-category cashier-category--active" : "cashier-category"} onClick={() => setActiveCategory(category)}>{category}</button>)}</div><div className="cashier-grid">{filteredItems.map((item) => <button type="button" className="cashier-product" key={item.id} onClick={() => addToCart(item)} disabled={item.unavailable}><FoodVisual item={item} size="mini" /><div><span className={`dietary-dot dietary-dot--${item.dietary}`} /><strong>{item.name}</strong><small>{item.unavailable ? "Unavailable" : `${item.prepMinutes} min`}</small></div><b>{formatMoney(item.price)}</b><span className="cashier-product__add"><Plus size={16} /></span></button>)}</div>{!filteredItems.length && <div className="empty-state"><UtensilsCrossed size={30} /><strong>No live menu items are available.</strong><span>Menu data appears here after the API responds.</span></div>}</section>
        <aside className="pos-bill"><div className="pos-bill__top"><div><span className="eyebrow">Live bill</span><h2>{cart.length ? `${cart.length} menu selections` : "Start a fresh bill"}</h2></div><button type="button" className="quiet-button quiet-button--danger" onClick={clearCart} disabled={!cart.length || isMutating}>Clear</button></div><div className="order-mode-row">{(["DINE_IN", "PICKUP", "COUNTER"] as DiningMode[]).map((mode) => <button key={mode} type="button" className={cartMode === mode ? "order-mode order-mode--active" : "order-mode"} aria-pressed={cartMode === mode} onClick={() => { setCartMode(mode); if (mode !== "DINE_IN") setDineInTableSelected(false); }}>{mode === "DINE_IN" ? "Dine in" : mode === "PICKUP" ? "Pickup" : "Counter"}</button>)}</div>{cartMode === "DINE_IN" && tables.length > 0 && <><label className="table-selector"><Table2 size={17} /><span>Table</span><select value={dineInTableSelected ? selectedTableId : ""} onChange={(event) => { const table = tables.find((candidate) => candidate.id === event.target.value); selectTable(event.target.value); setDineInTableSelected(true); setDineInGuestDraft(Math.max(1, table?.guests || 1)); }}><option value="" disabled>Select a table</option>{tables.map((table) => <option key={table.id} value={table.id}>{table.label}</option>)}</select><ChevronDown size={16} /></label>{dineInTableSelected && selectedTable && <div className="cashier-guest-control"><span>Guests for <b>{selectedTable.label}</b></span><div><button type="button" aria-label="Remove guest" onClick={() => hasActiveDineInSession ? adjustGuests(selectedTable.id, -1) : setDineInGuestDraft((current) => Math.max(1, current - 1))} disabled={dineInGuestCount <= 1 || isMutating}><Minus size={15} /></button><b>{dineInGuestCount}</b><button type="button" aria-label="Add guest" onClick={() => hasActiveDineInSession ? adjustGuests(selectedTable.id, 1) : setDineInGuestDraft((current) => Math.min(selectedTable.seats, current + 1))} disabled={dineInGuestCount >= selectedTable.seats || isMutating}><Plus size={15} /></button></div><small>{hasActiveDineInSession ? "Updating the active table session" : "This guest count opens the table session with the order"}</small></div>}</>}
          <div className="pos-bill__lines">{cart.length ? cart.map((line) => <article className="pos-line" key={line.id}><div className={`pos-line__dot swatch--${line.item.color}`} /><div><strong>{line.item.name}</strong><span>{cartLineLabels(line).join(" / ") || "Standard preparation"}</span><b>{formatMoney(cartLineTotal(line))}</b></div><QuantityControl quantity={line.quantity} onChange={(changeQuantity) => updateLineQuantity(line.id, changeQuantity)} compact /></article>) : <div className="empty-state pos-empty"><UtensilsCrossed size={31} /><strong>Tap a menu item to build the order.</strong><span>Totals and payment stay visible here.</span></div>}</div>
          <div className="pos-bill__totals"><dl className="order-totals"><div><dt>Items</dt><dd>{formatMoney(cartSubtotal)}</dd></div><div><dt>Tax · 5%</dt><dd>{formatMoney(cartTax)}</dd></div>{cartService > 0 && <div><dt>Service · 5%</dt><dd>{formatMoney(cartService)}</dd></div>}<div className="order-totals__total"><dt>Total due</dt><dd>{formatMoney(cartTotal)}</dd></div></dl></div>
          <div className="payment-section"><div className="payment-section__heading"><span>Settlement</span><StatusPill status={cart.length ? "UNPAID" : "DRAFT"} subtle /></div><div className="payment-methods">{(["Cash", "Pay later"] as const).map((method) => <button type="button" key={method} className={paymentMethod === method ? "payment-method payment-method--selected" : "payment-method"} onClick={() => setPaymentMethod(method)}>{method === "Cash" ? "Cash" : <Clock3 size={17} />}<span>{method}</span>{paymentMethod === method && <Check size={15} />}</button>)}</div>{paymentMethod === "Cash" && <div className="cash-input"><label htmlFor="cash-tendered">Cash received</label><div><span>INR</span><input id="cash-tendered" inputMode="numeric" value={cashTendered} onChange={(event) => setCashTendered(event.target.value.replace(/[^0-9]/g, ""))} placeholder="0" /></div>{tender > 0 && <small>Change to return: <b>{formatMoney(change)}</b></small>}</div>}</div>
          <button type="button" className="button button--saffron button--full pos-pay-button" onClick={checkout} disabled={isMutating || !cart.length || dineInDetailsIncomplete || (paymentMethod === "Cash" && tender < cartTotal)}><span>{isMutating ? "Saving securely..." : paymentMethod === "Cash" ? "Settle cash and send" : "Send to kitchen - unpaid"}</span><strong>{formatMoney(cartTotal)}</strong></button><p className="pos-bill__footnote">{cartMode === "DINE_IN" && dineInTableSelected && selectedTable ? `${selectedTable.label} / ${dineInGuestCount} guests` : "Select table and guests"} / Server calculates final price</p>
        </aside>
      </div>
    </section>
  </main>;
};
