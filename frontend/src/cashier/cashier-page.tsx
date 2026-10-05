import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Bell, Check, ChevronDown, CircleHelp, Clock3, LayoutGrid, LockKeyhole, MenuSquare, Minus, MoreHorizontal, Plus, ReceiptText, Search, Settings2, ShoppingBasket, Table2, UtensilsCrossed, WalletCards } from "lucide-react";
import { Brand } from "@/shared/components/brand";
import { CashierShiftPanel } from "./cashier-shift-panel";
import { MenuManagementPanel } from "./menu-management-panel";
import { ConnectionBadge } from "@/shared/components/connection-badge";
import { StaffProfileMenu } from "@/shared/components/staff-profile-menu";
import { FoodVisual } from "@/shared/components/food-visual";
import { ItemConfigurator, requiresConfiguration } from "@/shared/components/item-configurator";
import { QuantityControl } from "@/shared/components/quantity-control";
import { StatusPill } from "@/shared/components/status-pill";
import { useLiveUpdates } from "@/shared/hooks/useLiveUpdates";
import { formatClock, formatMoney } from "@/shared/lib/format";
import { ApiError, api } from "@/shared/lib/api";
import { useClock } from "@/shared/hooks/useClock";
import { usePos } from "@/shared/store/pos-store";
import { cartLineLabels, cartLineTotal } from "@/shared/lib/cart";
import type { DiningMode, DiningTable, MenuItem, Order } from "@/shared/types/domain";
import { isActiveOrder } from "@/shared/lib/order-state";

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
const tableStatusLabel: Record<DiningTable["status"], string> = {
  available: "Available", seated: "Occupied", attention: "Needs attention", ready: "Ready to serve", bill: "Bill requested",
};
const tableStatusLegend: DiningTable["status"][] = ["available", "seated", "ready", "bill", "attention"];
const tableOccupancyLabel = (table: DiningTable) => table.status === "available" ? table.seats + " seats open" : table.guests + "/" + table.seats + " seated";
type OrderOperationCardProps = {
  order: Order;
  mode: "orders" | "payments";
  pending: boolean;
  onServe: (orderId: string) => void;
  onTakeCash: (orderId: string, cashReceivedPaise: number) => void;
  onComplete: (orderId: string) => void;
};

const OrderOperationCard = ({ order, mode, pending, onServe, onTakeCash, onComplete }: OrderOperationCardProps) => {
  const [cashReceived, setCashReceived] = useState("");
  const tender = Number(cashReceived) || 0;
  const needsCash = order.paymentStatus === "UNPAID" || order.paymentStatus === "PAYMENT_FAILED";
  const hasReadyItems = order.items.some((item) => item.status === "READY");
  const canComplete = order.status === "SERVED" && order.paymentStatus === "PAID";
  const fulfilmentLabel = order.mode === "PICKUP" || order.mode === "COUNTER" ? "Mark collected" : "Mark ready items served";
  const orderProgressHint = order.status === "COMPLETED" ? "This order is closed." : order.status === "SERVED" ? "Take payment before completing this order." : "Kitchen and service updates appear here in real time.";

  return <article className="operations-order-card">
    <div className="operations-order-card__summary">
      <div>
        <strong>{order.displayId} - {order.tableLabel}</strong>
        <small>{order.mode.replace("_", " ").toLowerCase()} - {order.items.length} {order.items.length === 1 ? "item" : "items"}</small>
      </div>
      <div>
        <b>{formatMoney(order.total)}</b>
        <span><StatusPill status={order.status} subtle /><StatusPill status={order.paymentStatus} subtle /></span>
      </div>
    </div>
    {mode === "orders" && <div className="operations-order-card__actions">
      {hasReadyItems && <button type="button" className="button button--saffron" onClick={() => onServe(order.id)} disabled={pending}>{pending ? "Saving..." : fulfilmentLabel}</button>}
      {canComplete && <button type="button" className="outline-button" onClick={() => onComplete(order.id)} disabled={pending}>{pending ? "Saving..." : "Complete order"}</button>}
      {!hasReadyItems && !canComplete && <small className="operations-order-card__hint">{orderProgressHint}</small>}
    </div>}
    {mode === "payments" && <div className="operations-order-card__actions operations-order-card__actions--payment">
      {needsCash ? <><label>Cash received<input aria-label={"Cash received for " + order.displayId} inputMode="decimal" value={cashReceived} onChange={(event) => setCashReceived(event.target.value.replace(/[^0-9.]/g, ""))} placeholder={String(order.total)} /></label><button type="button" className="button button--saffron" onClick={() => onTakeCash(order.id, Math.round(tender * 100))} disabled={pending || tender < order.total}>{pending ? "Saving..." : "Take cash"}</button>{tender > 0 && tender >= order.total && <small>Change: <b>{formatMoney(tender - order.total)}</b></small>}</> : <small className="operations-order-card__hint">{order.paymentStatus === "PAYMENT_PENDING" ? "Payment confirmation is in progress." : "This payment needs a different settlement action."}</small>}
    </div>}
  </article>;
};

export const CashierPage = () => {
  const {
    cart, cartSubtotal, cartTax, cartService, cartTotal, addToCart, updateLineQuantity,
    clearCart, cartMode, setCartMode, tables, selectedTableId, selectTable, adjustGuests, placeOrder, orders, menu, menuCategories, pricing, demoMode, isPending, refreshMenu, refreshOperations, notify, logout, session, serveOrder, takeCashPayment, completeOrder,
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
  const [menuUpdateId, setMenuUpdateId] = useState<string>();
  const [availabilitySearch, setAvailabilitySearch] = useState("");
  const [configuringItem, setConfiguringItem] = useState<MenuItem>();
  const navigate = useNavigate();
  const now = useClock(30_000);
  const live = useLiveUpdates((events) => {
    if (events.has("menu:updated") || events.has("connection:restored")) refreshMenu();
    if ([...events].some((event) => event !== "menu:updated")) refreshOperations();
  }, !demoMode);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key !== "F2") return;
      event.preventDefault();
      document.querySelector<HTMLInputElement>(".cashier-products .search-field input")?.focus();
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);
  const selectedTable = tables.find((table) => table.id === selectedTableId);
  const cashierCategories = ["All", ...(menuCategories.length ? menuCategories.filter((category) => category.visible !== false).map((category) => category.name) : [...new Set(menu.map((item) => item.category))])];
  const filteredItems = useMemo(() => menu.filter((item) => {
    const needle = search.toLowerCase().trim();
    const haystack = item.name + " " + item.description;
    return (activeCategory === "All" || item.category === activeCategory) && (!needle || haystack.toLowerCase().includes(needle));
  }).sort((left, right) => left.name.localeCompare(right.name)), [activeCategory, menu, search]);
  const availabilityGroups = useMemo(() => {
    const needle = availabilitySearch.trim().toLocaleLowerCase();
    const groups = new Map<string, MenuItem[]>();
    for (const item of menu) {
      const haystack = item.name + " " + item.description;
      if (needle && !haystack.toLocaleLowerCase().includes(needle)) continue;
      const category = item.category || "Uncategorised";
      const categoryItems = groups.get(category) ?? [];
      categoryItems.push(item);
      groups.set(category, categoryItems);
    }
    return [...groups.entries()].map(([category, items]) => ({ category, items: [...items].sort((left, right) => left.name.localeCompare(right.name)) })).sort((left, right) => left.category.localeCompare(right.category));
  }, [availabilitySearch, menu]);
  const availableMenuItemCount = menu.filter((item) => !item.unavailable).length;
  const addMenuItem = (item: MenuItem) => {
    if (requiresConfiguration(item)) setConfiguringItem(item);
    else addToCart(item);
  };
  const tender = Number(cashTendered) || 0;
  const change = Math.max(0, tender - cartTotal);
  const taxRate = pricing.tax.rateBasisPoints / 100;
  const serviceRate = pricing.serviceCharge.rateBasisPoints / 100;
  const taxLabel = pricing.tax.inclusive ? `Tax included · ${taxRate}%` : `Tax · ${taxRate}%`;
  const serviceLabel = `Service · ${serviceRate}%`;
  const activeOrders = orders.filter((order) => isActiveOrder(order.status)).length;
  const isMutating = isPending("order:create:cashier") || isPending(`table:${selectedTableId}:update`);
  const cashierName = session?.name ?? "Cashier";
  const cashierInitials = cashierName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();


  const hasActiveDineInSession = dineInTableSelected && Boolean(selectedTable && selectedTable.guests > 0);
  const dineInGuestCount = dineInTableSelected ? (hasActiveDineInSession ? selectedTable?.guests ?? 0 : dineInGuestDraft) : 0;
  const dineInDetailsIncomplete = cartMode === "DINE_IN" && (!dineInTableSelected || dineInGuestCount < 1);
  const chooseDineInTable = (tableId: string) => {
    const table = tables.find((candidate) => candidate.id === tableId);
    selectTable(tableId);
    setDineInTableSelected(true);
    setDineInGuestDraft(Math.max(1, table?.guests || 1));
  };
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
    if (label === "POS") {
      document.querySelector(".cashier-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (label === "Orders" || label === "Payments" || label === "Settings") return;
    if (label === "Shift") return;
    if (label === "Reports") {
      loadReports();
      return;
    }
    notify(`${label} is selected. Operational controls stay available in the live bill.`, "info");
  };
  const lockRegister = () => { logout(); navigate("/login"); };
  const changeAvailability = (item: MenuItem) => {
    if (demoMode) {
      notify("Preview inventory is seeded and resets with the preview state.", "info");
      return;
    }
    setMenuUpdateId(item.id);
    void api.menu.setAvailability(item.id, Boolean(item.unavailable)).then(() => {
      notify(`${item.name} is now ${item.unavailable ? "available" : "unavailable"}.`, "success");
      refreshMenu();
    }).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "Menu availability could not be updated.", "danger");
    }).finally(() => setMenuUpdateId(undefined));
  };


  return <main className="cashier-page">
    <aside className="cashier-sidebar"><Brand inverse /><nav aria-label="Cashier navigation">{navItems.map(([Icon, label]) => <button type="button" key={label} className={activeNav === label ? "cashier-nav-item cashier-nav-item--active" : "cashier-nav-item"} aria-label={label} aria-current={activeNav === label ? "page" : undefined} onClick={() => openCashierSection(label)}><Icon size={19} /><span>{label}</span>{label === "Orders" && activeOrders > 0 && <b>{activeOrders}</b>}</button>)}</nav><div className="cashier-sidebar__footer"><button type="button" className="cashier-profile" onClick={() => notify(`${cashierName} cashier profile.`, "info")}><span>{cashierInitials}</span><div><strong>{cashierName}</strong><small>Cashier workspace</small></div><MoreHorizontal size={18} /></button><button type="button" className="lock-button" onClick={lockRegister}><LockKeyhole size={17} /> Lock register</button></div></aside>
    <section className="cashier-workspace">
      <header className="cashier-header"><div><span className="eyebrow">Cashier workspace</span><h1>New order</h1></div><div className="cashier-header__tools"><span className="cashier-time">{formatClock(new Date(now))}</span><ConnectionBadge live={live} /><button type="button" className="icon-button" aria-label="Notifications" onClick={() => notify(activeOrders ? `${activeOrders} open orders need attention.` : "No new cashier alerts.", "info")}><Bell size={19} />{activeOrders > 0 && <b className="notification-dot" />}</button><button type="button" className="icon-button" aria-label="Help" onClick={() => notify("Search, add items, choose settlement, then send the order to kitchen.", "info")}><CircleHelp size={19} /></button><StaffProfileMenu className="cashier-header__profile" /></div></header>
      <nav className="cashier-mobile-nav" aria-label="Cashier navigation">
        {navItems.map(([Icon, label]) => <button type="button" key={label} className={activeNav === label ? "cashier-mobile-nav__item cashier-mobile-nav__item--active" : "cashier-mobile-nav__item"} aria-label={label} aria-current={activeNav === label ? "page" : undefined} onClick={() => openCashierSection(label)}><Icon size={16} /><span>{label}</span>{label === "Orders" && activeOrders > 0 && <b>{activeOrders}</b>}</button>)}
      </nav>
      <button type="button" className="cashier-mobile-bill" onClick={() => document.querySelector(".pos-bill")?.scrollIntoView({ behavior: "smooth", block: "start" })} aria-label={`Review live bill, ${cart.length} menu selections, ${formatMoney(cartTotal)}`}><span>Live bill</span><strong>{cart.length ? `${cart.length} item${cart.length === 1 ? "" : "s"}` : "Start bill"}</strong><b>{formatMoney(cartTotal)} · Review</b></button>
      {activeNav === "Menu" && <section className="cashier-operations-panel" aria-live="polite"><header><div><span className="eyebrow">Menu operations</span><h2>Availability by category</h2><p className="availability-summary">{availableMenuItemCount} of {menu.length} dishes are currently available to sell.</p></div><button type="button" className="outline-button" onClick={refreshMenu}>Refresh menu</button></header>
        <label className="availability-search"><Search size={16} /><span className="sr-only">Find a menu item</span><input value={availabilitySearch} onChange={(event) => setAvailabilitySearch(event.target.value)} placeholder="Find a dish" /></label>
        <div className="availability-groups">{availabilityGroups.map(({ category, items }) => <details key={category} className="availability-category" open={Boolean(availabilitySearch)}><summary><span><strong>{category}</strong><small>{items.filter((item) => !item.unavailable).length} of {items.length} available</small></span><b>{items.length}</b><ChevronDown size={16} /></summary><div className="menu-availability-list">{items.map((item) => <article key={item.id}><i className={item.unavailable ? "availability-indicator availability-indicator--unavailable" : "availability-indicator availability-indicator--available"} aria-hidden="true" /><div><strong>{item.name}</strong><small>{item.unavailable ? "Unavailable to guests" : "Available to guests"}</small></div><button type="button" className={item.unavailable ? "outline-button" : "quiet-button quiet-button--danger"} onClick={() => changeAvailability(item)} disabled={menuUpdateId === item.id}>{menuUpdateId === item.id ? "Saving…" : item.unavailable ? "Mark available" : "Mark unavailable"}</button></article>)}</div></details>)}</div>{!availabilityGroups.length && <div className="empty-state"><UtensilsCrossed size={28} /><strong>No dishes match that search.</strong><span>Clear the search to review the full catalogue.</span></div>}
      </section>}{["Tables", "Orders", "Payments"].includes(activeNav) && <section className="cashier-operations-panel" aria-live="polite"><header><div><span className="eyebrow">Register operations</span><h2>{activeNav}</h2></div><button type="button" className="outline-button" onClick={() => setActiveNav("POS")}>Back to POS</button></header>{activeNav === "Tables" && <div className="operations-table-grid">{tables.map((table) => <button type="button" key={table.id} className={"operations-table-card operations-table-card--" + table.status} onClick={() => { chooseDineInTable(table.id); setCartMode("DINE_IN"); document.querySelector(".cashier-table-picker")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}><span><b>{table.label}</b><small>{table.zone}</small></span><span><b>{tableOccupancyLabel(table)}</b><small className={"table-occupancy table-occupancy--" + table.status}><i aria-hidden="true" />{tableStatusLabel[table.status]}</small></span></button>)}</div>}{activeNav === "Orders" && <div className="operations-list operations-list--actionable">{orders.length ? orders.map((order) => <OrderOperationCard key={order.id} order={order} mode="orders" pending={isPending("order:" + order.id + ":serve") || isPending("order:" + order.id + ":complete")} onServe={serveOrder} onTakeCash={takeCashPayment} onComplete={completeOrder} />) : <p>No orders are available for this register.</p>}</div>}{activeNav === "Payments" && <div className="operations-list operations-list--actionable">{orders.filter((order) => order.paymentStatus !== "PAID" && order.paymentStatus !== "REFUNDED").length ? orders.filter((order) => order.paymentStatus !== "PAID" && order.paymentStatus !== "REFUNDED").map((order) => <OrderOperationCard key={order.id} order={order} mode="payments" pending={isPending("payment:" + order.id + ":cash")} onServe={serveOrder} onTakeCash={takeCashPayment} onComplete={completeOrder} />) : <p>All visible orders are settled.</p>}</div>}</section>}{activeNav === "Reports" && <section className="cashier-report-panel" aria-live="polite"><header><div><span className="eyebrow">Sales reporting</span><h2>Today’s register summary</h2></div><button type="button" className="outline-button" onClick={loadReports} disabled={reportLoading}>{reportLoading ? "Refreshing…" : "Refresh"}</button></header>{reportError && <div className="report-message report-message--error">{reportError}</div>}{reportLoading && !report && <div className="report-message">Loading report…</div>}{report && <><div className="report-metrics"><article><span>Sales</span><strong>{formatMoney(report.totalSales)}</strong><small>{report.orderCount} orders</small></article><article><span>Collected</span><strong>{formatMoney(report.paid)}</strong><small>Settled payments</small></article><article><span>Average order</span><strong>{formatMoney(report.averageOrder)}</strong><small>Before refunds</small></article><article><span>Refunded</span><strong>{formatMoney(report.refunded)}</strong><small>In this period</small></article></div><div className="report-breakdowns"><section><h3>Sales by channel</h3>{Object.entries(report.byMode).length ? Object.entries(report.byMode).map(([mode, amount]) => <div key={mode}><span>{mode.replace("_", " ")}</span><b>{formatMoney(amount)}</b></div>) : <p>No completed sales in this period.</p>}</section><section><h3>Payments by provider</h3>{Object.entries(report.byProvider).length ? Object.entries(report.byProvider).map(([provider, amount]) => <div key={provider}><span>{provider}</span><b>{formatMoney(amount)}</b></div>) : <p>No settled payments in this period.</p>}</section></div><small className="report-window">{demoMode ? "Preview calculation from the current demo data." : `Live period: ${new Date(report.from).toLocaleString()} – ${new Date(report.to).toLocaleString()}.`}</small></>}</section>}{activeNav === "Shift" && <CashierShiftPanel notify={notify} />}{activeNav === "Settings" && <><section className="cashier-operations-panel cashier-operations-panel--settings" aria-live="polite"><header><div><span className="eyebrow">Register controls</span><h2>Settings</h2></div><button type="button" className="outline-button" onClick={() => setActiveNav("POS")}>Back to POS</button></header><div className="operations-list"><article><div><strong>Current operator</strong><small>{cashierName}</small></div><button type="button" className="outline-button" onClick={lockRegister}>Lock register</button></article><article><div><strong>Catalogue status</strong><small>{demoMode ? "Preview data is isolated to this browser." : "Changes are published to live staff and guest menu sessions."}</small></div><button type="button" className="outline-button" onClick={refreshMenu}>Refresh menu</button></article></div></section><MenuManagementPanel items={menu} categories={menuCategories} demoMode={demoMode} refreshMenu={refreshMenu} notify={notify} /></>}<div className="cashier-body">
        <section className="cashier-products" id="cashier-products"><div className="cashier-products__top"><label className="search-field search-field--operational"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search menu or item" /><kbd>F2</kbd></label><button type="button" className="outline-button" aria-live="polite" onClick={() => openCashierSection("Orders")}><ShoppingBasket size={17} /> Open orders <b>{activeOrders}</b></button></div><div className="cashier-categories">{cashierCategories.map((category) => <button type="button" key={category} className={category === activeCategory ? "cashier-category cashier-category--active" : "cashier-category"} onClick={() => setActiveCategory(category)}>{category}</button>)}</div><div className="cashier-grid">{filteredItems.map((item) => <button type="button" className="cashier-product" key={item.id} onClick={() => addMenuItem(item)} disabled={item.unavailable}><FoodVisual item={item} size="mini" /><div><span className={`dietary-dot dietary-dot--${item.dietary}`} role="img" aria-label={item.dietary} /><strong>{item.name}</strong><small>{item.unavailable ? "Unavailable" : `${item.prepMinutes} min`}</small></div><b>{formatMoney(item.price)}</b><span className="cashier-product__add"><Plus size={16} /></span></button>)}</div>{!filteredItems.length && <div className="empty-state"><UtensilsCrossed size={30} /><strong>No live menu items are available.</strong><span>Menu data appears here after the API responds.</span></div>}</section>
        <aside className="pos-bill"><div className="pos-bill__top"><div><span className="eyebrow">Live bill</span><h2>{cart.length ? `${cart.length} menu selections` : "Start a fresh bill"}</h2></div><button type="button" className="quiet-button quiet-button--danger" onClick={clearCart} disabled={!cart.length || isMutating}>Clear</button></div><div className="order-mode-row">{(["DINE_IN", "PICKUP", "COUNTER"] as DiningMode[]).map((mode) => <button key={mode} type="button" className={cartMode === mode ? "order-mode order-mode--active" : "order-mode"} aria-pressed={cartMode === mode} onClick={() => { setCartMode(mode); if (mode !== "DINE_IN") setDineInTableSelected(false); }}>{mode === "DINE_IN" ? "Dine in" : mode === "PICKUP" ? "Pickup" : "Counter"}</button>)}</div>{cartMode === "DINE_IN" && tables.length > 0 && <><section className="cashier-table-picker" aria-label="Dine-in table selection"><label className="table-selector"><Table2 size={17} /><span>Table</span><select value={dineInTableSelected ? selectedTableId : ""} onChange={(event) => chooseDineInTable(event.target.value)}><option value="" disabled>Select a table</option>{tables.map((table) => <option key={table.id} value={table.id}>{table.label} — {tableStatusLabel[table.status]} · {tableOccupancyLabel(table)}</option>)}</select><ChevronDown size={16} /></label><div className="table-selector__meta" aria-live="polite">{selectedTable ? <><span className={"table-occupancy table-occupancy--" + selectedTable.status}><i aria-hidden="true" />{tableStatusLabel[selectedTable.status]}</span><small>{tableOccupancyLabel(selectedTable)} · {selectedTable.zone}</small></> : <small>Choose a table to see its live occupancy.</small>}</div><div className="table-selector__legend" aria-label="Table status colours">{tableStatusLegend.map((status) => <span key={status} className={"table-occupancy table-occupancy--" + status}><i aria-hidden="true" />{tableStatusLabel[status]}</span>)}</div></section>{dineInTableSelected && selectedTable && <div className="cashier-guest-control"><span>Guests for <b>{selectedTable.label}</b></span><div><button type="button" aria-label="Remove guest" onClick={() => hasActiveDineInSession ? adjustGuests(selectedTable.id, -1) : setDineInGuestDraft((current) => Math.max(1, current - 1))} disabled={dineInGuestCount <= 1 || isMutating}><Minus size={15} /></button><b>{dineInGuestCount}</b><button type="button" aria-label="Add guest" onClick={() => hasActiveDineInSession ? adjustGuests(selectedTable.id, 1) : setDineInGuestDraft((current) => Math.min(selectedTable.seats, current + 1))} disabled={dineInGuestCount >= selectedTable.seats || isMutating}><Plus size={15} /></button></div><small>{hasActiveDineInSession ? "Updating the active table session" : "This guest count opens the table session with the order"}</small></div>}</>}<div className="pos-bill__lines">{cart.length ? cart.map((line) => <article className="pos-line" key={line.id}><div className={`pos-line__dot swatch--${line.item.color}`} /><div><strong>{line.item.name}</strong><span>{cartLineLabels(line).join(" / ") || "Standard preparation"}</span><b>{formatMoney(cartLineTotal(line))}</b></div><QuantityControl quantity={line.quantity} onChange={(changeQuantity) => updateLineQuantity(line.id, changeQuantity)} compact /></article>) : <div className="empty-state pos-empty"><UtensilsCrossed size={31} /><strong>Tap a menu item to build the order.</strong><span>Totals and payment stay visible here.</span></div>}</div>
          <div className="pos-bill__totals"><dl className="order-totals"><div><dt>Items</dt><dd>{formatMoney(cartSubtotal)}</dd></div>{pricing.tax.enabled && <div><dt>{taxLabel}</dt><dd>{formatMoney(cartTax)}</dd></div>}{cartService > 0 && <div><dt>{serviceLabel}</dt><dd>{formatMoney(cartService)}</dd></div>}<div className="order-totals__total"><dt>Total due</dt><dd>{formatMoney(cartTotal)}</dd></div></dl></div>
          <div className="payment-section"><div className="payment-section__heading"><span>Settlement</span><StatusPill status={cart.length ? "UNPAID" : "DRAFT"} subtle /></div><div className="payment-methods">{(["Cash", "Pay later"] as const).map((method) => <button type="button" key={method} className={paymentMethod === method ? "payment-method payment-method--selected" : "payment-method"} onClick={() => setPaymentMethod(method)}>{method === "Cash" ? "Cash" : <Clock3 size={17} />}<span>{method}</span>{paymentMethod === method && <Check size={15} />}</button>)}</div>{paymentMethod === "Cash" && <div className="cash-input"><label htmlFor="cash-tendered">Cash received</label><div><span>INR</span><input id="cash-tendered" inputMode="numeric" value={cashTendered} onChange={(event) => setCashTendered(event.target.value.replace(/[^0-9]/g, ""))} placeholder="0" /></div>{tender > 0 && <small>Change to return: <b>{formatMoney(change)}</b></small>}</div>}</div>
          <button type="button" className="button button--saffron button--full pos-pay-button" onClick={checkout} disabled={isMutating || !cart.length || dineInDetailsIncomplete || (paymentMethod === "Cash" && tender < cartTotal)}><span>{isMutating ? "Saving securely..." : paymentMethod === "Cash" ? "Settle cash and send" : "Send to kitchen - unpaid"}</span><strong>{formatMoney(cartTotal)}</strong></button><p className="pos-bill__footnote">{cartMode === "DINE_IN" && dineInTableSelected && selectedTable ? `${selectedTable.label} / ${dineInGuestCount} guests` : cartMode === "PICKUP" ? "Pickup order" : cartMode === "COUNTER" ? "Counter walk-in" : "Choose a table, then guest count"} / Server calculates final price</p>
        </aside>
      </div>
    </section>
    {configuringItem && <ItemConfigurator item={configuringItem} onAdd={(selection) => addToCart(configuringItem, selection)} onClose={() => setConfiguringItem(undefined)} submitLabel="Add to bill" />}
  </main>;
};
