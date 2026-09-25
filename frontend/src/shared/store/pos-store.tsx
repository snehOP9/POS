import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { ApiError, api, getAccessToken, setAccessToken } from "@/shared/lib/api";
import { initialOrders, initialTables, initialTickets, menuItems as previewMenuItems } from "@/shared/data/demo";
import { normalizeMenuPayload, normalizeRestaurantPricing } from "@/shared/lib/menu-adapter";
import { normalizeOrders, normalizeTables, normalizeTickets } from "@/shared/lib/operations-adapter";
import type {
  AuthSession,
  CartLine,
  DiningMode,
  DiningTable,
  ItemStatus,
  KitchenTicket,
  MenuItem,
  Order,
  OrderItem,
  Role,
  RestaurantPricingConfig,
  ToastMessage,
} from "@/shared/types/domain";

import { calculateCartPricing, cartLineLabels, cartLineTotal, cartLineUnitPrice, cartSelectionKey, fallbackRestaurantPricing, type CartSelection } from "@/shared/lib/cart";
const cartStorageKey = "emberserve.customer-cart:v2";
const legacyCartStorageKey = "emberserve.customer-cart";

const readStoredCart = (): CartLine[] => {
  try {
    const stored = localStorage.getItem(cartStorageKey) ?? localStorage.getItem(legacyCartStorageKey);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((raw) => {
      if (typeof raw !== "object" || raw === null) return [];
      const record = raw as Record<string, unknown>;
      if (typeof record.id !== "string" || typeof record.quantity !== "number" || typeof record.item !== "object" || record.item === null) return [];
      const rawVariant = record.variant;
      const variant = typeof rawVariant === "object" && rawVariant !== null && typeof (rawVariant as Record<string, unknown>).id === "string"
        ? rawVariant as CartLine["variant"]
        : undefined;
      const modifiers = Array.isArray(record.modifiers)
        ? record.modifiers.filter((modifier) => typeof modifier === "object" && modifier !== null && typeof (modifier as Record<string, unknown>).id === "string") as NonNullable<CartLine["modifiers"]>
        : [];
      return [{
        id: record.id,
        item: record.item as MenuItem,
        quantity: Math.max(1, Math.min(99, Math.trunc(record.quantity))),
        ...(typeof record.note === "string" ? { note: record.note } : {}),
        ...(variant ? { variant } : {}),
        modifiers,
      }];
    });
  } catch {
    return [];
  }
};

const ticketStatusFromItems = (items: OrderItem[]): KitchenTicket["status"] => {
  if (items.every((item) => item.status === "READY")) return "ready";
  if (items.some((item) => item.status === "PREPARING" || item.status === "READY")) return "preparing";
  return "new";
};

const orderStatusFromItems = (items: OrderItem[]): Order["status"] => {
  if (items.every((item) => item.status === "READY")) return "READY";
  if (items.some((item) => item.status === "READY")) return "PARTIALLY_READY";
  if (items.some((item) => item.status === "PREPARING")) return "PREPARING";
  return "CONFIRMED";
};

const readResponseId = (value: unknown): string | undefined => {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.id === "string") return record.id;
  if (typeof record._id === "string") return record._id;
  const order = record.order;
  if (typeof order === "object" && order !== null) {
    const orderRecord = order as Record<string, unknown>;
    if (typeof orderRecord.id === "string") return orderRecord.id;
    if (typeof orderRecord._id === "string") return orderRecord._id;
  }
  return undefined;
};

interface PosStore {
  menu: MenuItem[];
  menuLoading: boolean;
  pricing: RestaurantPricingConfig;
  menuError?: string;
  refreshMenu: () => void;
  refreshOperations: () => void;
  cart: CartLine[];
  cartSubtotal: number;
  cartTax: number;
  cartService: number;
  cartTotal: number;
  cartMode: DiningMode;
  cartOpen: boolean;
  tables: DiningTable[];
  orders: Order[];
  tickets: KitchenTicket[];
  selectedTableId: string;
  toasts: ToastMessage[];
  session?: AuthSession;
  authLoading: boolean;
  demoMode: boolean;
  isMutating: boolean;
  addToCart: (item: MenuItem, selection?: CartSelection) => void;
  updateLineQuantity: (lineId: string, adjustment: number) => void;
  clearCart: () => void;
  setCartMode: (mode: DiningMode) => void;
  setCartOpen: (open: boolean) => void;
  selectTable: (tableId: string) => void;
  adjustGuests: (tableId: string, adjustment: number) => void;
  openTableSession: (tableId: string, guestCount: number, note?: string) => void;
  updateTableSession: (tableId: string, guestCount: number, note?: string) => void;
  closeTableSession: (tableId: string) => void;
  placeOrder: (source: "customer" | "waiter" | "cashier", payment?: "UNPAID" | "PAID", cashReceivedPaise?: number, pickup?: { name: string; phone: string }, guestCount?: number) => void;
  startTicket: (ticketId: string) => void;
  markTicketItemReady: (ticketId: string, itemId: string) => void;
  markTicketReady: (ticketId: string) => void;
  bumpTicket: (ticketId: string) => void;
  serveOrder: (orderId: string) => void;
  requestBill: (tableId: string) => void;
  settleOrder: (orderId: string) => void;
  notify: (message: string, tone?: ToastMessage["tone"]) => void;
  login: (role: Role, name: string, accessToken?: string, preview?: boolean) => void;
  logout: () => void;
}

const PosContext = createContext<PosStore | undefined>(undefined);

export const PosProvider = ({ children }: PropsWithChildren) => {
  const [cart, setCart] = useState<CartLine[]>(readStoredCart);
  const [cartMode, setCartMode] = useState<DiningMode>("DINE_IN");
  const [cartOpen, setCartOpen] = useState(false);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [pricing, setPricing] = useState<RestaurantPricingConfig>(fallbackRestaurantPricing);
  const [menuError, setMenuError] = useState<string>();
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [selectedTableId, setSelectedTableId] = useState("t3");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [session, setSession] = useState<AuthSession>();
  const [authLoading, setAuthLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const restoreAttempt = useRef(0);

  useEffect(() => {
    const attempt = ++restoreAttempt.current;
    const isCurrentAttempt = () => restoreAttempt.current === attempt;

    const restoreSession = async () => {
      try {
        let accessToken = getAccessToken();
        if (!accessToken) accessToken = (await api.auth.refresh()).accessToken;
        const identity = await api.auth.me();
        if (isCurrentAttempt()) {
          setSession({ role: identity.user.role, name: identity.user.name, accessToken });
        }
      } catch {
        if (isCurrentAttempt()) {
          setAccessToken();
          setSession(undefined);
          setDemoMode(true);
        }
      } finally {
        if (isCurrentAttempt()) setAuthLoading(false);
      }
    };

    void restoreSession();
    return () => {
      if (isCurrentAttempt()) restoreAttempt.current += 1;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(cart));
      localStorage.removeItem(legacyCartStorageKey);
    } catch {
    }
  }, [cart]);

  const notify = useCallback((message: string, tone: ToastMessage["tone"] = "success") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4_000);
  }, []);

  const refreshMenu = useCallback(() => {
    if (demoMode) {
      setMenu(previewMenuItems);
      setMenuError(undefined);
      setPricing(fallbackRestaurantPricing);
      setMenuLoading(false);
      return;
    }
    setMenuLoading(true);
    setMenuError(undefined);
    void api.menu.getPublic({ available: true }).then((payload) => {
      const nextMenu = normalizeMenuPayload(payload);
      setMenu(nextMenu);
      setPricing(normalizeRestaurantPricing(payload));
      if (!nextMenu.length) setMenuError("The restaurant has no available menu items right now.");
    }).catch((error: unknown) => {
      setMenu([]);
      setMenuError(error instanceof ApiError ? error.message : "The live menu is temporarily unavailable.");
    }).finally(() => setMenuLoading(false));
  }, [demoMode]);

  const refreshOperations = useCallback(() => {
    if (demoMode || !session) return;
    if (session.role === "KITCHEN") {
      void api.kitchen.listTickets().then((payload) => {
        setTickets(normalizeTickets(payload, []));
      }).catch((error: unknown) => {
        notify(error instanceof ApiError ? error.message : "The live kitchen board is unavailable.", "danger");
      });
      return;
    }
    if (session.role === "CUSTOMER") {
      void api.orders.list().then((payload) => {
        setOrders(normalizeOrders(payload));
      }).catch((error: unknown) => {
        notify(error instanceof ApiError ? error.message : "Your live order history is unavailable.", "danger");
      });
      return;
    }
    const loadTables = session.role === "WAITER" ? api.waiter.listTables() : api.tables.list();
    const loadOrders = session.role === "CASHIER" ? api.cashier.listOrders() : api.orders.list();
    void Promise.all([loadTables, loadOrders]).then(([tablesPayload, ordersPayload]) => {
      const nextOrders = normalizeOrders(ordersPayload);
      setOrders(nextOrders);
      setTables(normalizeTables(tablesPayload, nextOrders));
    }).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "Live operational data is unavailable.", "danger");
    });
  }, [demoMode, notify, session]);

  useEffect(() => {
    refreshOperations();
  }, [refreshOperations]);

  useEffect(() => {
    refreshMenu();
  }, [refreshMenu]);

  useEffect(() => {
    if (demoMode) {
      setTables(initialTables);
      setOrders(initialOrders);
      setTickets(initialTickets);
      return;
    }
    setTables([]);
    setOrders([]);
    setTickets([]);
  }, [demoMode]);

  const addToCart = useCallback((item: MenuItem, selection: CartSelection = {}) => {
    if (item.unavailable) {
      notify(`${item.name} is unavailable right now.`, "danger");
      return;
    }
    if (selection.variant && !selection.variant.available) {
      notify(`${selection.variant.name} is unavailable right now.`, "danger");
      return;
    }
    if (selection.modifiers?.some((modifier) => !modifier.available)) {
      notify("One of the selected options is unavailable right now.", "danger");
      return;
    }
    const selectedKey = cartSelectionKey(item, selection);
    setCart((current) => {
      const existing = current.find((line) => cartSelectionKey(line.item, line) === selectedKey);
      if (existing) {
        return current.map((line) => line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line);
      }
      return [...current, { id: `${item.id}-${Date.now()}`, item, quantity: 1, variant: selection.variant, modifiers: selection.modifiers ?? [] }];
    });
    notify(`${item.name} added to order.`, "info");
  }, [notify]);

  const updateLineQuantity = useCallback((lineId: string, adjustment: number) => {
    setCart((current) => current.flatMap((line) => {
      if (line.id !== lineId) return [line];
      const quantity = line.quantity + adjustment;
      return quantity > 0 ? [{ ...line, quantity }] : [];
    }));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCartOpen(false);
  }, []);

  const selectTable = useCallback((tableId: string) => setSelectedTableId(tableId), []);

  const adjustGuests = useCallback((tableId: string, adjustment: number) => {
    const table = tables.find((candidate) => candidate.id === tableId);
    if (!table) return;
    const guestCount = Math.min(table.seats, Math.max(0, table.guests + adjustment));
    if (!demoMode) {
      if (!table.sessionId || guestCount < 1) {
        notify("Open the table session before changing its guest count.", "info");
        return;
      }
      if (isMutating) return;
      setIsMutating(true);
      void api.waiter.updateTableSession(tableId, { guestCount }).then(() => refreshOperations()).catch((error: unknown) => {
        notify(error instanceof ApiError ? error.message : "Guest count could not be updated.", "danger");
      }).finally(() => setIsMutating(false));
      return;
    }
    setTables((current) => current.map((candidate) => candidate.id === tableId ? {
      ...candidate,
      guests: guestCount,
      status: guestCount ? (candidate.status === "available" ? "seated" : candidate.status) : "available",
    } : candidate));
  }, [demoMode, isMutating, notify, refreshOperations, tables]);

  const openTableSession = useCallback((tableId: string, guestCount: number, note?: string) => {
    const table = tables.find((candidate) => candidate.id === tableId);
    if (!table) return;
    if (guestCount < 1 || guestCount > table.seats) {
      notify(`Enter between 1 and ${table.seats} guests for ${table.label}.`, "danger");
      return;
    }
    if (demoMode) {
      setTables((current) => current.map((candidate) => candidate.id === tableId ? { ...candidate, guests: guestCount, status: "seated", sessionNote: note } : candidate));
      notify(`${table.label} opened for ${guestCount} guest${guestCount === 1 ? "" : "s"}.`, "success");
      return;
    }
    if (isMutating) return;
    setIsMutating(true);
    void api.waiter.openTable(tableId, { guestCount, note }).then(() => refreshOperations()).then(() => notify(`${table.label} opened for ${guestCount} guest${guestCount === 1 ? "" : "s"}.`, "success")).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "The table could not be opened.", "danger");
    }).finally(() => setIsMutating(false));
  }, [demoMode, isMutating, notify, refreshOperations, tables]);

  const updateTableSession = useCallback((tableId: string, guestCount: number, note?: string) => {
    const table = tables.find((candidate) => candidate.id === tableId);
    if (!table) return;
    if (guestCount < 1 || guestCount > table.seats) {
      notify(`Enter between 1 and ${table.seats} guests for ${table.label}.`, "danger");
      return;
    }
    if (demoMode) {
      setTables((current) => current.map((candidate) => candidate.id === tableId ? { ...candidate, guests: guestCount, sessionNote: note ?? candidate.sessionNote } : candidate));
      notify(`${table.label} guest count updated.`, "info");
      return;
    }
    if (!table.sessionId || isMutating) return;
    setIsMutating(true);
    void api.waiter.updateTableSession(tableId, { guestCount, note }).then(() => refreshOperations()).then(() => notify(`${table.label} guest count updated.`, "info")).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "The table session could not be updated.", "danger");
    }).finally(() => setIsMutating(false));
  }, [demoMode, isMutating, notify, refreshOperations, tables]);

  const closeTableSession = useCallback((tableId: string) => {
    const table = tables.find((candidate) => candidate.id === tableId);
    if (!table) return;
    if (demoMode) {
      setTables((current) => current.map((candidate) => candidate.id === tableId ? { ...candidate, guests: 0, status: "available", elapsedMinutes: 0, total: 0, orderId: undefined, sessionId: undefined, sessionOpenedAt: undefined, sessionNote: undefined } : candidate));
      notify(`${table.label} is available again.`, "success");
      return;
    }
    if (isMutating) return;
    setIsMutating(true);
    void api.tables.closeSession(tableId).then(() => refreshOperations()).then(() => notify(`${table.label} session closed.`, "success")).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "The table session could not be closed.", "danger");
    }).finally(() => setIsMutating(false));
  }, [demoMode, isMutating, notify, refreshOperations, tables]);

  const placeOrder = useCallback((source: "customer" | "waiter" | "cashier", payment: "UNPAID" | "PAID" = "UNPAID", cashReceivedPaise?: number, pickup?: { name: string; phone: string }, guestCount?: number) => {
    if (!cart.length) {
      notify("Add something delicious before placing an order.", "danger");
      return;
    }
    if (isMutating) return;

    const table = tables.find((candidate) => candidate.id === selectedTableId);
    const numericId = 1050 + orders.length;
    const orderId = `ord-${numericId}-${Date.now()}`;
    const projectedPricing = calculateCartPricing(cart.reduce((sum, line) => sum + cartLineTotal(line), 0), pricing);
    const total = projectedPricing.total;
    const orderItems: OrderItem[] = cart.map((line) => ({
      id: `${line.id}-order`,
      name: line.item.name,
      quantity: line.quantity,
      price: cartLineUnitPrice(line),
      status: "PENDING",
      modifiers: cartLineLabels(line),
      note: line.note,
    }));
    const createdOrder: Order = {
      id: orderId,
      displayId: `#${numericId}`,
      tableLabel: cartMode === "DINE_IN" ? (table?.label ?? "Table") : cartMode === "PICKUP" ? `Pickup - ${pickup?.name || "Guest"}` : "Counter walk-in",
      mode: cartMode,
      status: "CONFIRMED",
      paymentStatus: payment === "PAID" ? "PAYMENT_PENDING" : "UNPAID",
      createdAt: new Date().toISOString(),
      total,
      items: orderItems,
    };
    const newTickets = Object.entries(
      orderItems.reduce<Record<string, OrderItem[]>>((groups, item) => {
        const original = cart.find((line) => `${line.id}-order` === item.id)?.item;
        const station = original?.station ?? "Hot";
        groups[station] = [...(groups[station] ?? []), item];
        return groups;
      }, {}),
    ).map(([station, items]) => ({
      id: `kt-${numericId}-${station.toLowerCase()}-${Date.now()}`,
      orderId,
      displayId: createdOrder.displayId,
      tableLabel: createdOrder.tableLabel,
      station: station as KitchenTicket["station"],
      priority: "normal" as const,
      startedAt: new Date().toISOString(),
      status: "new" as const,
      items,
    }));
    const commitOrder = (order: Order, message: string, tone: ToastMessage["tone"] = "success") => {
      const ticketsForOrder = newTickets.map((ticket) => ({ ...ticket, orderId: order.id, displayId: order.displayId, tableLabel: order.tableLabel }));
      setOrders((current) => [order, ...current]);
      if (demoMode) setTickets((current) => [...ticketsForOrder, ...current]);
      if (demoMode && cartMode === "DINE_IN" && table) {
        setTables((current) => current.map((candidate) => candidate.id === table.id ? {
          ...candidate,
          guests: candidate.guests || Math.min(guestCount ?? 2, candidate.seats),
          status: "seated",
          total: candidate.total + total,
          orderId: order.id,
        } : candidate));
      }
      setCart([]);
      setCartOpen(false);
      notify(message, tone);
      if (!demoMode) refreshOperations();
    };
    const requestPayload = {
      mode: cartMode,
      tableId: cartMode === "DINE_IN" && table ? selectedTableId : undefined,
      guestCount: cartMode === "DINE_IN" ? guestCount : undefined,
      guestName: cartMode === "PICKUP" ? pickup?.name || "Guest" : undefined,
      guestPhone: cartMode === "PICKUP" ? pickup?.phone : undefined,
      items: cart.map((line) => ({ menuItemId: line.item.id, quantity: line.quantity, variantId: line.variant?.id, modifierOptionIds: line.modifiers?.map((modifier) => modifier.id) ?? [], note: line.note })),
    };

    if (demoMode) {
      const demoOrder = payment === "PAID" ? { ...createdOrder, paymentStatus: "PAID" as const } : createdOrder;
      commitOrder(demoOrder, source === "cashier" ? `Preview: ${demoOrder.displayId} settled and sent to kitchen.` : `Preview: ${demoOrder.displayId} is with the kitchen.`);
      return;
    }

    setIsMutating(true);
    notify(`Creating ${createdOrder.displayId} with the server…`, "info");
    void (source === "waiter" && table
      ? api.waiter.createOrder(table.id, { ...requestPayload, tableId: undefined })
      : source === "cashier"
        ? api.cashier.createOrder(requestPayload)
        : api.orders.create(requestPayload)).then(async (persisted) => {
      const persistedId = readResponseId(persisted) ?? createdOrder.id;
      const tableLabels = new Map(tables.map((candidate) => [candidate.id, candidate.label]));
      const canonical = normalizeOrders([persisted], tableLabels)[0];
      const persistedOrder = canonical ? { ...createdOrder, ...canonical, id: persistedId } : { ...createdOrder, id: persistedId };
      if (payment !== "PAID") {
        commitOrder(persistedOrder, `${persistedOrder.displayId} is with the kitchen.`);
        return;
      }
      try {
        if (typeof cashReceivedPaise !== "number") {
          commitOrder(persistedOrder, `${persistedOrder.displayId} was created and awaits settlement.`, "info");
          return;
        }
        await api.payments.cash({ orderId: persistedId, cashReceivedPaise });
        commitOrder({ ...persistedOrder, paymentStatus: "PAID" }, `${persistedOrder.displayId} paid and sent to kitchen.`);
      } catch (error) {
        commitOrder({ ...persistedOrder, paymentStatus: "PAYMENT_PENDING" }, `${persistedOrder.displayId} was created, but cash settlement needs attention.`, "danger");
        if (error instanceof ApiError) notify(error.message, "danger");
      }
    }).catch((error: unknown) => {
      const message = error instanceof ApiError ? error.message : "The API is unavailable. Your order has not been created.";
      notify(message, "danger");
    }).finally(() => setIsMutating(false));
  }, [cart, cartMode, demoMode, isMutating, notify, orders.length, pricing, refreshOperations, selectedTableId, tables]);

  const startTicket = useCallback((ticketId: string) => {
    const ticket = tickets.find((candidate) => candidate.id === ticketId);
    if (!ticket) return;
    const items = ticket.items.map((item) => ({ ...item, status: (item.status === "PENDING" || item.status === "QUEUED" ? "PREPARING" : item.status) as ItemStatus }));
    const apply = () => {
      setTickets((current) => current.map((candidate) => candidate.id === ticketId ? { ...candidate, status: "preparing", items } : candidate));
      setOrders((current) => current.map((order) => order.id === ticket.orderId ? {
        ...order,
        status: "PREPARING",
        items: order.items.map((item) => items.find((update) => update.id === item.id) ?? item),
      } : order));
      notify(`${ticket.displayId} is now cooking.`, "info");
      if (!demoMode) refreshOperations();
    };
    if (demoMode) { apply(); return; }
    if (isMutating) return;
    setIsMutating(true);
    void api.kitchen.updateTicket(ticketId, "ACCEPTED").then(() => api.kitchen.updateTicket(ticketId, "PREPARING")).then(apply).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "Kitchen update could not reach the server.", "danger");
    }).finally(() => setIsMutating(false));
  }, [demoMode, isMutating, notify, refreshOperations, tickets]);

  const markTicketItemReady = useCallback((ticketId: string, itemId: string) => {
    const ticket = tickets.find((candidate) => candidate.id === ticketId);
    if (!ticket) return;
    const items = ticket.items.map((item) => item.id === itemId ? { ...item, status: "READY" as const } : item);
    const ticketStatus = ticketStatusFromItems(items);
    const apply = () => {
      setTickets((current) => current.map((candidate) => candidate.id === ticketId ? { ...candidate, status: ticketStatus, items } : candidate));
      setOrders((current) => current.map((order) => {
        if (order.id !== ticket.orderId) return order;
        const nextItems = order.items.map((item) => items.find((update) => update.id === item.id) ?? item);
        return { ...order, items: nextItems, status: orderStatusFromItems(nextItems) };
      }));
      if (ticketStatus === "ready") {
        setTables((current) => current.map((table) => table.orderId === ticket.orderId ? { ...table, status: "ready" } : table));
        notify(`${ticket.displayId} is ready to serve.`, "success");
      } else {
        notify(`${ticket.displayId}: item marked ready.`, "info");
      }
      if (!demoMode) refreshOperations();
    };
    if (demoMode) { apply(); return; }
    if (isMutating) return;
    setIsMutating(true);
    const update = api.kitchen.updateItem(ticketId, itemId, "READY");
    const finalUpdate = ticketStatus === "ready" ? update.then(() => api.kitchen.updateTicket(ticketId, "READY")) : update;
    void finalUpdate.then(apply).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "Item status could not be saved.", "danger");
    }).finally(() => setIsMutating(false));
  }, [demoMode, isMutating, notify, refreshOperations, tickets]);

  const markTicketReady = useCallback((ticketId: string) => {
    const ticket = tickets.find((candidate) => candidate.id === ticketId);
    if (!ticket) return;
    const items = ticket.items.map((item) => ({ ...item, status: "READY" as const }));
    const apply = () => {
      setTickets((current) => current.map((candidate) => candidate.id === ticketId ? { ...candidate, status: "ready", items } : candidate));
      setOrders((current) => current.map((order) => {
        if (order.id !== ticket.orderId) return order;
        const nextItems = order.items.map((item) => items.find((update) => update.id === item.id) ?? item);
        return { ...order, items: nextItems, status: orderStatusFromItems(nextItems) };
      }));
      setTables((current) => current.map((table) => table.orderId === ticket.orderId ? { ...table, status: "ready" } : table));
      notify(`${ticket.displayId} is ready to serve.`, "success");
      if (!demoMode) refreshOperations();
    };
    if (demoMode) { apply(); return; }
    if (isMutating) return;
    setIsMutating(true);
    void Promise.all(ticket.items.filter((item) => item.status !== "READY").map((item) => api.kitchen.updateItem(ticketId, item.id, "READY")))
      .then(() => api.kitchen.updateTicket(ticketId, "READY"))
      .then(apply)
      .catch((error: unknown) => {
        notify(error instanceof ApiError ? error.message : "Ticket could not be marked ready.", "danger");
      }).finally(() => setIsMutating(false));
  }, [demoMode, isMutating, notify, refreshOperations, tickets]);

  const bumpTicket = useCallback((ticketId: string) => {
    const ticket = tickets.find((candidate) => candidate.id === ticketId);
    if (!ticket) return;
    const apply = () => {
      setTickets((current) => current.filter((candidate) => candidate.id !== ticketId));
      notify(`${ticket.displayId} bumped from the line.`, "success");
      if (!demoMode) refreshOperations();
    };
    if (demoMode) { apply(); return; }
    if (isMutating) return;
    setIsMutating(true);
    void api.kitchen.updateTicket(ticketId, "COMPLETED").then(apply).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "Ticket could not be bumped.", "danger");
    }).finally(() => setIsMutating(false));
  }, [demoMode, isMutating, notify, refreshOperations, tickets]);

  const serveOrder = useCallback((orderId: string) => {
    const order = orders.find((candidate) => candidate.id === orderId);
    if (!order) return;
    const apply = () => {
      setOrders((current) => current.map((candidate) => candidate.id === orderId ? {
        ...candidate,
        status: "SERVED",
        items: candidate.items.map((item) => ({ ...item, status: "SERVED" as const })),
      } : candidate));
      setTables((current) => current.map((table) => table.orderId === orderId ? { ...table, status: "bill" } : table));
      notify(`${order.displayId} marked served.`, "success");
      if (!demoMode) refreshOperations();
    };
    if (demoMode) { apply(); return; }
    if (isMutating) return;
    setIsMutating(true);
    const readyItems = order.items.filter((item) => item.status === "READY");
    void Promise.all(readyItems.map((item) => api.orders.updateItem(orderId, item.id, "SERVED"))).then(() => api.orders.updateStatus(orderId, "SERVED")).then(apply).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "Serve update could not be saved.", "danger");
    }).finally(() => setIsMutating(false));
  }, [demoMode, isMutating, notify, orders, refreshOperations]);

  const requestBill = useCallback((tableId: string) => {
    const table = tables.find((candidate) => candidate.id === tableId);
    if (!table) return;
    const apply = () => {
      setTables((current) => current.map((candidate) => candidate.id === tableId ? { ...candidate, status: "bill" } : candidate));
      notify(`${table.label} bill requested at cashier.`, "info");
      if (!demoMode) refreshOperations();
    };
    if (demoMode) { apply(); return; }
    if (isMutating) return;
    if (!table.orderId) {
      notify("There is no active order to bill for this table.", "danger");
      return;
    }
    setIsMutating(true);
    void api.waiter.requestBill(table.orderId).then(apply).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "Bill request could not be sent.", "danger");
    }).finally(() => setIsMutating(false));
  }, [demoMode, isMutating, notify, refreshOperations, tables]);

  const settleOrder = useCallback((orderId: string) => {
    const order = orders.find((candidate) => candidate.id === orderId);
    if (!order) return;
    const apply = () => {
      setOrders((current) => current.map((candidate) => candidate.id === orderId ? { ...candidate, status: "COMPLETED", paymentStatus: "PAID" } : candidate));
      setTables((current) => current.map((table) => table.orderId === orderId ? { ...table, guests: 0, total: 0, orderId: undefined, status: "available", elapsedMinutes: 0 } : table));
      notify(`${order.displayId} paid and completed.`, "success");
      if (!demoMode) refreshOperations();
    };
    if (demoMode) { apply(); return; }
    if (isMutating) return;
    setIsMutating(true);
    void api.payments.cash({ orderId, cashReceivedPaise: Math.round(order.total * 100) }).then(() => api.orders.updateStatus(orderId, "COMPLETED")).then(apply).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "Settlement could not be confirmed.", "danger");
    }).finally(() => setIsMutating(false));
  }, [demoMode, isMutating, notify, orders, refreshOperations]);

  const login = useCallback((role: Role, name: string, accessToken?: string, preview = false) => {
    restoreAttempt.current += 1;
    setAuthLoading(false);
    setDemoMode(preview);
    if (preview) {
      setMenu(previewMenuItems);
      setPricing(fallbackRestaurantPricing);
      setMenuError(undefined);
      setMenuLoading(false);
    }
    setSession({ role, name, accessToken, preview });
  }, []);
  const logout = useCallback(() => {
    restoreAttempt.current += 1;
    if (!demoMode && getAccessToken()) void api.auth.logout().catch(() => undefined);
    setAccessToken();
    setAuthLoading(false);
    setDemoMode(false);
    setSession(undefined);
  }, [demoMode]);

  const { subtotal: cartSubtotal, tax: cartTax, service: cartService, total: cartTotal } = calculateCartPricing(
    cart.reduce((sum, line) => sum + cartLineTotal(line), 0),
    pricing,
  );

  const value = useMemo<PosStore>(() => ({
    menu, pricing, menuLoading, menuError, refreshMenu, refreshOperations, cart, cartSubtotal, cartTax, cartService, cartTotal, cartMode, cartOpen, tables, orders, tickets,
    selectedTableId, toasts, session, authLoading, demoMode, isMutating, addToCart, updateLineQuantity, clearCart, setCartMode, setCartOpen,
    selectTable, adjustGuests, openTableSession, updateTableSession, closeTableSession, placeOrder, startTicket, markTicketItemReady, markTicketReady, bumpTicket, serveOrder,
    requestBill, settleOrder, notify, login, logout,
  }), [
    addToCart, adjustGuests, bumpTicket, cart, cartMode, cartOpen, cartService, cartSubtotal, cartTax,
    authLoading, cartTotal, clearCart, demoMode, isMutating, login, logout, markTicketItemReady, menu, menuError, menuLoading, notify, orders, placeOrder, pricing, refreshMenu, requestBill,
    closeTableSession, openTableSession, selectedTableId, serveOrder, session, settleOrder, startTicket, markTicketReady, tables, tickets, toasts, updateLineQuantity, updateTableSession,
  ]);

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
};

export const usePos = () => {
  const context = useContext(PosContext);
  if (!context) throw new Error("usePos must be used inside PosProvider");
  return context;
};
