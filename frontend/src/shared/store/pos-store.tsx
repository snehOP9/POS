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
import { menuItems as previewMenuItems } from "@/shared/data/demo";
import { formatMoney } from "@/shared/lib/format";
import { normalizeMenuCategories, normalizeMenuPayload, normalizeRestaurantPricing } from "@/shared/lib/menu-adapter";
import { normalizeOrders, normalizeTables, normalizeTickets } from "@/shared/lib/operations-adapter";
import { clearPreviewState, createPreviewChannel, createPreviewOrigin, isNewerPreviewState, previewSeed, readPreviewState, type PreviewRestaurantState, writePreviewState } from "@/shared/lib/preview-state";
import type {
  AuthSession,
  CartLine,
  DiningMode,
  DiningTable,
  ItemStatus,
  KitchenTicket,
  MenuItem,
  MenuCategory,
  Order,
  OrderItem,
  Role,
  RestaurantPricingConfig,
  ToastMessage,
} from "@/shared/types/domain";

import { calculateCartPricing, cartLineLabels, cartLineTotal, cartLineUnitPrice, cartSelectionKey, fallbackRestaurantPricing, type CartSelection } from "@/shared/lib/cart";
const cartStorageKey = "emberserve.customer-cart:v2";
const previewCartStorageKey = "emberserve.preview-customer-cart:v1";
const legacyCartStorageKey = "emberserve.customer-cart";

const categoriesFromMenu = (items: MenuItem[]): MenuCategory[] => Array.from(new Map(items.map((item, index) => [item.category, {
  id: item.categoryId ?? `preview-category-${index}`,
  name: item.category,
  sortOrder: index,
  visible: true,
}])).values());

const readStoredCart = (preview = false): CartLine[] => {
  try {
    const stored = localStorage.getItem(preview ? previewCartStorageKey : cartStorageKey)
      ?? (preview ? null : localStorage.getItem(legacyCartStorageKey));
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
  menuCategories: MenuCategory[];
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
  isPending: (operation: string) => boolean;
  resetPreview: () => void;
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
  placeOrder: (source: "customer" | "waiter" | "cashier", payment?: "UNPAID" | "PAID", cashReceivedPaise?: number, pickup?: { name: string; phone: string }, guestCount?: number, tableToken?: string) => void;
  startTicket: (ticketId: string) => void;
  markTicketItemReady: (ticketId: string, itemId: string) => void;
  markTicketReady: (ticketId: string) => void;
  bumpTicket: (ticketId: string) => void;
  serveOrder: (orderId: string) => void;
  requestBill: (tableId: string) => void;
  takeCashPayment: (orderId: string, cashReceivedPaise: number) => void;
  completeOrder: (orderId: string) => void;
  notify: (message: string, tone?: ToastMessage["tone"]) => void;
  login: (role: Role, name: string, accessToken?: string, preview?: boolean) => void;
  logout: () => void;
}

const PosContext = createContext<PosStore | undefined>(undefined);

export const PosProvider = ({ children }: PropsWithChildren) => {
  const [cart, setCart] = useState<CartLine[]>(() => readStoredCart());
  const [cartMode, setCartMode] = useState<DiningMode>("DINE_IN");
  const [cartOpen, setCartOpen] = useState(false);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
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
  const [pendingOperations, setPendingOperations] = useState<Set<string>>(() => new Set());
  const restoreAttempt = useRef(0);
  const pendingOperationRef = useRef(new Set<string>());
  const previewOrigin = useRef(createPreviewOrigin());
  const previewStateRef = useRef<PreviewRestaurantState>();
  const applyingPreviewState = useRef(false);
  const previewChannelRef = useRef<BroadcastChannel>();

  useEffect(() => {
    const attempt = ++restoreAttempt.current;
    const isCurrentAttempt = () => restoreAttempt.current === attempt;

    const restoreSession = async () => {
      const accessToken = getAccessToken();
      if (!accessToken) {
        if (isCurrentAttempt()) setAuthLoading(false);
        return;
      }
      try {
        const identity = await api.auth.me();
        if (isCurrentAttempt()) {
          setSession({ role: identity.user.role, name: identity.user.name, accessToken });
        }
      } catch {
        if (isCurrentAttempt()) {
          setAccessToken();
          setSession(undefined);
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
      localStorage.setItem(demoMode ? previewCartStorageKey : cartStorageKey, JSON.stringify(cart));
      if (!demoMode) localStorage.removeItem(legacyCartStorageKey);
    } catch {
      // Storage is optional; the cart remains available in memory.
    }
  }, [cart, demoMode]);

  const notify = useCallback((message: string, tone: ToastMessage["tone"] = "success") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4_000);
  }, []);

  const startOperation = useCallback((operation: string): boolean => {
    if (pendingOperationRef.current.has(operation)) {
      notify("That action is already being saved.", "info");
      return false;
    }
    pendingOperationRef.current.add(operation);
    setPendingOperations(new Set(pendingOperationRef.current));
    return true;
  }, [notify]);

  const finishOperation = useCallback((operation: string) => {
    pendingOperationRef.current.delete(operation);
    setPendingOperations(new Set(pendingOperationRef.current));
  }, []);

  const isPending = useCallback((operation: string) => pendingOperations.has(operation), [pendingOperations]);

  const applyPreviewState = useCallback((next: PreviewRestaurantState) => {
    applyingPreviewState.current = true;
    previewStateRef.current = next;
    setTables(next.tables);
    setOrders(next.orders);
    setTickets(next.tickets);
  }, []);

  const resetPreview = useCallback(() => {
    const next = previewSeed(previewOrigin.current);
    clearPreviewState();
    writePreviewState(next);
    previewChannelRef.current?.postMessage(next);
    applyPreviewState(next);
    setCart([]);
    try {
      localStorage.removeItem(previewCartStorageKey);
    } catch {
      // Storage is optional; the in-memory reset remains deterministic.
    }
    notify("Preview restaurant reset to its seeded state.", "success");
  }, [applyPreviewState, notify]);

  const refreshMenu = useCallback(() => {
    if (demoMode) {
      setMenu(previewMenuItems);
      setMenuCategories(categoriesFromMenu(previewMenuItems));
      setMenuError(undefined);
      setPricing(fallbackRestaurantPricing);
      setMenuLoading(false);
      return;
    }
    setMenuLoading(true);
    setMenuError(undefined);
    const loadMenu = session?.role === "CASHIER" ? api.menu.getManaged() : api.menu.getPublic({ available: true });
    void loadMenu.then((payload) => {
      const nextMenu = normalizeMenuPayload(payload);
      setMenu(nextMenu);
      setMenuCategories(normalizeMenuCategories(payload));
      setPricing(normalizeRestaurantPricing(payload));
      if (!nextMenu.length) setMenuError("The restaurant has no available menu items right now.");
    }).catch((error: unknown) => {
      setMenu([]);
      setMenuCategories([]);
      setMenuError(error instanceof ApiError ? error.message : "The live menu is temporarily unavailable.");
    }).finally(() => setMenuLoading(false));
  }, [demoMode, session?.role]);

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
    if (authLoading) return;
    if (!demoMode && !session) {
      setMenuLoading(false);
      setMenuError(undefined);
      return;
    }
    refreshMenu();
  }, [authLoading, demoMode, refreshMenu, session]);

  useEffect(() => {
    if (demoMode) {
      const channel = createPreviewChannel();
      previewChannelRef.current = channel;
      const applyIncoming = (value: unknown) => {
        if (!value || typeof value !== "object") return;
        const next = value as PreviewRestaurantState;
        if (!Array.isArray(next.tables) || !Array.isArray(next.orders) || !Array.isArray(next.tickets)) return;
        if (isNewerPreviewState(next, previewStateRef.current)) applyPreviewState(next);
      };
      const stored = readPreviewState();
      const initial = stored ?? previewSeed(previewOrigin.current);
      if (!stored) writePreviewState(initial);
      applyPreviewState(initial);
      setCart(readStoredCart(true));
      if (channel) channel.onmessage = (event: MessageEvent<unknown>) => applyIncoming(event.data);
      const onStorage = (event: StorageEvent) => {
        if (event.key !== "emberserve.preview-restaurant:v1" || !event.newValue) return;
        try {
          applyIncoming(JSON.parse(event.newValue));
        } catch {
          // Invalid external storage is ignored instead of contaminating Preview state.
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener("storage", onStorage);
        channel?.close();
        if (previewChannelRef.current === channel) previewChannelRef.current = undefined;
      };
    }
    previewStateRef.current = undefined;
    applyingPreviewState.current = false;
    setTables([]);
    setOrders([]);
    setTickets([]);
    setCart(readStoredCart());
    return undefined;
  }, [applyPreviewState, demoMode]);

  useEffect(() => {
    if (!demoMode) return;
    if (applyingPreviewState.current) {
      applyingPreviewState.current = false;
      return;
    }
    const previous = previewStateRef.current;
    const next: PreviewRestaurantState = {
      revision: Math.max(Date.now(), (previous?.revision ?? 0) + 1),
      origin: previewOrigin.current,
      tables,
      orders,
      tickets,
    };
    previewStateRef.current = next;
    writePreviewState(next);
    previewChannelRef.current?.postMessage(next);
  }, [demoMode, orders, tables, tickets]);

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
      return [...current, { id: `${item.id}-${Date.now()}`, item, quantity: 1, note: selection.note?.trim() || undefined, variant: selection.variant, modifiers: selection.modifiers ?? [] }];
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
      const operation = `table:${tableId}:update`;
      if (!startOperation(operation)) return;
      void api.waiter.updateTableSession(tableId, { guestCount }).then(() => refreshOperations()).catch((error: unknown) => {
        notify(error instanceof ApiError ? error.message : "Guest count could not be updated.", "danger");
      }).finally(() => finishOperation(operation));
      return;
    }
    setTables((current) => current.map((candidate) => candidate.id === tableId ? {
      ...candidate,
      guests: guestCount,
      status: guestCount ? (candidate.status === "available" ? "seated" : candidate.status) : "available",
    } : candidate));
  }, [demoMode, finishOperation, notify, refreshOperations, startOperation, tables]);

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
    const operation = `table:${tableId}:open`;
    if (!startOperation(operation)) return;
    void api.waiter.openTable(tableId, { guestCount, note }).then(() => refreshOperations()).then(() => notify(`${table.label} opened for ${guestCount} guest${guestCount === 1 ? "" : "s"}.`, "success")).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "The table could not be opened.", "danger");
    }).finally(() => finishOperation(operation));
  }, [demoMode, finishOperation, notify, refreshOperations, startOperation, tables]);

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
    if (!table.sessionId) return;
    const operation = `table:${tableId}:update`;
    if (!startOperation(operation)) return;
    void api.waiter.updateTableSession(tableId, { guestCount, note }).then(() => refreshOperations()).then(() => notify(`${table.label} guest count updated.`, "info")).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "The table session could not be updated.", "danger");
    }).finally(() => finishOperation(operation));
  }, [demoMode, finishOperation, notify, refreshOperations, startOperation, tables]);

  const closeTableSession = useCallback((tableId: string) => {
    const table = tables.find((candidate) => candidate.id === tableId);
    if (!table) return;
    if (demoMode) {
      setTables((current) => current.map((candidate) => candidate.id === tableId ? { ...candidate, guests: 0, status: "available", elapsedMinutes: 0, total: 0, orderId: undefined, sessionId: undefined, sessionOpenedAt: undefined, sessionNote: undefined } : candidate));
      notify(`${table.label} is available again.`, "success");
      return;
    }
    const operation = `table:${tableId}:close`;
    if (!startOperation(operation)) return;
    void api.tables.closeSession(tableId).then(() => refreshOperations()).then(() => notify(`${table.label} session closed.`, "success")).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "The table session could not be closed.", "danger");
    }).finally(() => finishOperation(operation));
  }, [demoMode, finishOperation, notify, refreshOperations, startOperation, tables]);

  const placeOrder = useCallback((source: "customer" | "waiter" | "cashier", payment: "UNPAID" | "PAID" = "UNPAID", cashReceivedPaise?: number, pickup?: { name: string; phone: string }, guestCount?: number, tableToken?: string) => {
    if (!cart.length) {
      notify("Add something delicious before placing an order.", "danger");
      return;
    }
    const operation = `order:create:${source}`;
    if (!demoMode && !startOperation(operation)) return;

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
      tableToken: cartMode === "DINE_IN" && source === "customer" ? tableToken : undefined,
      guestName: cartMode === "PICKUP" ? pickup?.name || "Guest" : undefined,
      guestPhone: cartMode === "PICKUP" ? pickup?.phone : undefined,
      items: cart.map((line) => ({ menuItemId: line.item.id, quantity: line.quantity, variantId: line.variant?.id, modifierOptionIds: line.modifiers?.map((modifier) => modifier.id) ?? [], note: line.note })),
    };

    if (demoMode) {
      const demoOrder = payment === "PAID" ? { ...createdOrder, paymentStatus: "PAID" as const } : createdOrder;
      commitOrder(demoOrder, source === "cashier" ? `Preview: ${demoOrder.displayId} settled and sent to kitchen.` : `Preview: ${demoOrder.displayId} is with the kitchen.`);
      return;
    }

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
        commitOrder({ ...persistedOrder, paymentStatus: "PAID" }, `${persistedOrder.displayId} is paid and with the kitchen.`);
      } catch (error) {
        commitOrder({ ...persistedOrder, paymentStatus: "PAYMENT_PENDING" }, `${persistedOrder.displayId} was created, but cash settlement needs attention.`, "danger");
        if (error instanceof ApiError) notify(error.message, "danger");
      }
    }).catch((error: unknown) => {
      const message = error instanceof ApiError ? error.message : "The API is unavailable. Your order has not been created.";
      notify(message, "danger");
    }).finally(() => finishOperation(operation));
  }, [cart, cartMode, demoMode, finishOperation, notify, orders.length, pricing, refreshOperations, selectedTableId, startOperation, tables]);

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
    const operation = `ticket:${ticketId}:start`;
    if (!startOperation(operation)) return;
    void api.kitchen.updateTicket(ticketId, "ACCEPTED").then(() => api.kitchen.updateTicket(ticketId, "PREPARING")).then(apply).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "Kitchen update could not reach the server.", "danger");
    }).finally(() => finishOperation(operation));
  }, [demoMode, finishOperation, notify, refreshOperations, startOperation, tickets]);

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
    const operation = `ticket:${ticketId}:item:${itemId}:ready`;
    if (!startOperation(operation)) return;
    const update = api.kitchen.updateItem(ticketId, itemId, "READY");
    const finalUpdate = ticketStatus === "ready" ? update.then(() => api.kitchen.updateTicket(ticketId, "READY")) : update;
    void finalUpdate.then(apply).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "Item status could not be saved.", "danger");
    }).finally(() => finishOperation(operation));
  }, [demoMode, finishOperation, notify, refreshOperations, startOperation, tickets]);

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
    const operation = `ticket:${ticketId}:ready`;
    if (!startOperation(operation)) return;
    void Promise.all(ticket.items.filter((item) => item.status !== "READY").map((item) => api.kitchen.updateItem(ticketId, item.id, "READY")))
      .then(() => api.kitchen.updateTicket(ticketId, "READY"))
      .then(apply)
      .catch((error: unknown) => {
        notify(error instanceof ApiError ? error.message : "Ticket could not be marked ready.", "danger");
      }).finally(() => finishOperation(operation));
  }, [demoMode, finishOperation, notify, refreshOperations, startOperation, tickets]);

  const bumpTicket = useCallback((ticketId: string) => {
    const ticket = tickets.find((candidate) => candidate.id === ticketId);
    if (!ticket) return;
    const apply = () => {
      setTickets((current) => current.filter((candidate) => candidate.id !== ticketId));
      notify(`${ticket.displayId} bumped from the line.`, "success");
      if (!demoMode) refreshOperations();
    };
    if (demoMode) { apply(); return; }
    const operation = `ticket:${ticketId}:bump`;
    if (!startOperation(operation)) return;
    void api.kitchen.updateTicket(ticketId, "COMPLETED").then(apply).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "Ticket could not be bumped.", "danger");
    }).finally(() => finishOperation(operation));
  }, [demoMode, finishOperation, notify, refreshOperations, startOperation, tickets]);

  const serveOrder = useCallback((orderId: string) => {
    const order = orders.find((candidate) => candidate.id === orderId);
    if (!order) return;
    const readyItems = order.items.filter((item) => item.status === "READY");
    if (!readyItems.length) {
      notify(order.displayId + " has no ready items to serve.", "info");
      return;
    }
    const allItemsWillBeServed = order.items.every((item) => item.status === "READY" || item.status === "SERVED");
    const apply = () => {
      setOrders((current) => current.map((candidate) => candidate.id === orderId ? {
        ...candidate,
        status: allItemsWillBeServed ? "SERVED" : candidate.status,
        items: candidate.items.map((item) => item.status === "READY" ? { ...item, status: "SERVED" as const } : item),
      } : candidate));
      if (allItemsWillBeServed) setTables((current) => current.map((table) => table.orderId === orderId ? { ...table, status: "bill" } : table));
      notify(allItemsWillBeServed ? order.displayId + " marked served." : order.displayId + " ready items marked served.", "success");
      if (!demoMode) refreshOperations();
    };
    if (demoMode) { apply(); return; }
    const operation = "order:" + orderId + ":serve";
    if (!startOperation(operation)) return;
    void Promise.all(readyItems.map((item) => api.orders.updateItem(orderId, item.id, "SERVED"))).then(apply).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "Serve update could not be saved.", "danger");
    }).finally(() => finishOperation(operation));
  }, [demoMode, finishOperation, notify, orders, refreshOperations, startOperation]);

  const requestBill = useCallback((tableId: string) => {
    const table = tables.find((candidate) => candidate.id === tableId);
    if (!table) return;
    const apply = () => {
      setTables((current) => current.map((candidate) => candidate.id === tableId ? { ...candidate, status: "bill" } : candidate));
      notify(`${table.label} bill requested at cashier.`, "info");
      if (!demoMode) refreshOperations();
    };
    if (demoMode) { apply(); return; }
    if (!table.orderId) {
      notify("There is no active order to bill for this table.", "danger");
      return;
    }
    const operation = `table:${tableId}:bill`;
    if (!startOperation(operation)) return;
    void api.waiter.requestBill(table.orderId).then(apply).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "Bill request could not be sent.", "danger");
    }).finally(() => finishOperation(operation));
  }, [demoMode, finishOperation, notify, refreshOperations, startOperation, tables]);

  const takeCashPayment = useCallback((orderId: string, cashReceivedPaise: number) => {
    const order = orders.find((candidate) => candidate.id === orderId);
    if (!order) return;
    if (cashReceivedPaise < Math.round(order.total * 100)) {
      notify(`Enter at least ${formatMoney(order.total)} to take cash for ${order.displayId}.`, "danger");
      return;
    }
    const apply = () => {
      setOrders((current) => current.map((candidate) => candidate.id === orderId ? {
        ...candidate, paymentStatus: "PAID"
      } : candidate));
      notify(`${order.displayId} payment captured. Complete fulfilment when it has been served or collected.`, "success");
      if (!demoMode) refreshOperations();
    };
    if (demoMode) { apply(); return; }
    const operation = `payment:${orderId}:cash`;
    if (!startOperation(operation)) return;
    void api.payments.cash({ orderId, cashReceivedPaise }).then(apply).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "Cash payment could not be confirmed.", "danger");
    }).finally(() => finishOperation(operation));
  }, [demoMode, finishOperation, notify, orders, refreshOperations, startOperation]);

  const completeOrder = useCallback((orderId: string) => {
    const order = orders.find((candidate) => candidate.id === orderId);
    if (!order) return;
    if (order.status !== "SERVED") {
      notify(`${order.displayId} must be served or collected before completion.`, "danger");
      return;
    }
    if (order.paymentStatus !== "PAID") {
      notify(`${order.displayId} must be settled before completion.`, "danger");
      return;
    }
    const linkedTable = tables.find((table) => table.orderId === orderId);
    const apply = (tableReleased = false) => {
      setOrders((current) => current.map((candidate) => candidate.id === orderId ? { ...candidate, status: "COMPLETED" } : candidate));
      if (tableReleased) setTables((current) => current.map((table) => table.orderId === orderId ? { ...table, guests: 0, total: 0, orderId: undefined, status: "available", elapsedMinutes: 0 } : table));
      notify(tableReleased ? `${order.displayId} completed and ${order.tableLabel} is available.` : `${order.displayId} completed.`, "success");
      if (!demoMode) refreshOperations();
    };
    if (demoMode) { apply(Boolean(linkedTable)); return; }
    const operation = `order:${orderId}:complete`;
    if (!startOperation(operation)) return;
    void api.orders.updateStatus(orderId, "COMPLETED").then(async () => {
      if (!order.tableId) { apply(); return; }
      try {
        await api.tables.closeSession(order.tableId);
        apply(true);
      } catch (error) {
        if (error instanceof ApiError && error.code === "TABLE_HAS_UNSETTLED_ORDER") { apply(); return; }
        throw error;
      }
    }).catch((error: unknown) => {
      notify(error instanceof ApiError ? error.message : "Order completion could not be confirmed.", "danger");
    }).finally(() => finishOperation(operation));
  }, [demoMode, finishOperation, notify, orders, refreshOperations, startOperation, tables]);

  const login = useCallback((role: Role, name: string, accessToken?: string, preview = false) => {
    restoreAttempt.current += 1;
    setAuthLoading(false);
    setDemoMode(preview);
    if (preview) {
      setMenu(previewMenuItems);
      setMenuCategories(categoriesFromMenu(previewMenuItems));
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
    menu, menuCategories, pricing, menuLoading, menuError, refreshMenu, refreshOperations, cart, cartSubtotal, cartTax, cartService, cartTotal, cartMode, cartOpen, tables, orders, tickets,
    selectedTableId, toasts, session, authLoading, demoMode, isPending, resetPreview, addToCart, updateLineQuantity, clearCart, setCartMode, setCartOpen,
    selectTable, adjustGuests, openTableSession, updateTableSession, closeTableSession, placeOrder, startTicket, markTicketItemReady, markTicketReady, bumpTicket, serveOrder,
    requestBill, takeCashPayment, completeOrder, notify, login, logout,
  }), [
    addToCart, adjustGuests, bumpTicket, cart, cartMode, cartOpen, cartService, cartSubtotal, cartTax,
    authLoading, cartTotal, clearCart, demoMode, isPending, login, logout, markTicketItemReady, menu, menuCategories, menuError, menuLoading, notify, orders, placeOrder, pricing, refreshMenu, requestBill, resetPreview,
    closeTableSession, completeOrder, openTableSession, selectedTableId, serveOrder, session, startTicket, takeCashPayment, markTicketReady, tables, tickets, toasts, updateLineQuantity, updateTableSession,
  ]);

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
};

export const usePos = () => {
  const context = useContext(PosContext);
  if (!context) throw new Error("usePos must be used inside PosProvider");
  return context;
};
