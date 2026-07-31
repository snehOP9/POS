import type { DiningTable, ItemStatus, KitchenStation, KitchenTicket, Order, OrderItem, OrderStatus, PaymentStatus } from "@/shared/types/domain";

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | undefined => typeof value === "object" && value !== null ? value as UnknownRecord : undefined;
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown, fallback = ""): string => typeof value === "string" && value ? value : fallback;
const number = (value: unknown, fallback = 0): number => typeof value === "number" && Number.isFinite(value) ? value : fallback;

const orderStatuses = new Set<OrderStatus>(["DRAFT", "PLACED", "CONFIRMED", "ACCEPTED_BY_KITCHEN", "PREPARING", "PARTIALLY_READY", "READY", "SERVED", "COMPLETED", "CANCEL_REQUESTED", "CANCELLED", "REJECTED"]);
const itemStatuses = new Set<ItemStatus>(["PENDING", "QUEUED", "PREPARING", "READY", "SERVED", "CANCELLED"]);
const paymentStatuses = new Set<PaymentStatus>(["UNPAID", "PAYMENT_PENDING", "PARTIALLY_PAID", "PAID", "PAYMENT_FAILED", "REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED"]);

const station = (value: unknown): KitchenStation => {
  const raw = text(value).toUpperCase();
  if (raw.includes("TANDOOR") || raw.includes("GRILL")) return "Tandoor";
  if (raw.includes("COLD") || raw.includes("DESSERT")) return "Cold";
  if (raw.includes("BAR") || raw.includes("DRINK")) return "Bar";
  return "Hot";
};

const lineItems = (value: unknown): OrderItem[] => asArray(value).flatMap((entry, index) => {
  const line = asRecord(entry);
  if (!line) return [];
  const rawStatus = text(line.status, "PENDING") as ItemStatus;
  return [{
    id: text(line.lineId ?? line.id, `line-${index}`),
    name: text(line.name, "Menu item"),
    quantity: number(line.quantity, 1),
    price: number(line.unitPrice ?? line.price, number(line.unitPricePaise) / 100),
    status: itemStatuses.has(rawStatus) ? rawStatus : "PENDING",
    modifiers: asArray(line.modifiers).flatMap((modifier) => {
      const record = asRecord(modifier);
      return record ? [text(record.optionName ?? record.name)] : typeof modifier === "string" ? [modifier] : [];
    }).filter(Boolean),
    note: typeof line.note === "string" ? line.note : undefined,
  }];
});

export const normalizeOrders = (payload: unknown, tableLabels: Map<string, string> = new Map()): Order[] => asArray(payload).flatMap((entry, index) => {
  const record = asRecord(entry);
  if (!record) return [];
  const rawStatus = text(record.status, "CONFIRMED") as OrderStatus;
  const rawPayment = text(record.paymentStatus, "UNPAID") as PaymentStatus;
  const tableId = text(record.tableId);
  const mode = text(record.mode, "COUNTER");
  return [{
    id: text(record.id ?? record._id, `order-${index}`),
    displayId: text(record.orderNumber, `#${index + 1}`),
    tableLabel: tableLabels.get(tableId) ?? (mode === "PICKUP" ? `Pickup - ${text(record.guestName, "Guest")}` : mode === "COUNTER" ? "Counter walk-in" : "Dine in"),
    tableId: tableId || undefined,
    mode: mode === "DINE_IN" || mode === "PICKUP" || mode === "COUNTER" ? mode : "COUNTER",
    status: orderStatuses.has(rawStatus) ? rawStatus : "CONFIRMED",
    paymentStatus: paymentStatuses.has(rawPayment) ? rawPayment : "UNPAID",
    createdAt: text(record.createdAt, new Date().toISOString()),
    customerName: typeof record.guestName === "string" ? record.guestName : undefined,
    total: number(record.total, number(record.totalPaise) / 100),
    items: lineItems(record.items),
  }];
});

export const normalizeTables = (payload: unknown, orders: Order[] = []): DiningTable[] => asArray(payload).flatMap((entry, index) => {
  const table = asRecord(entry);
  if (!table) return [];
  const id = text(table.id ?? table._id, `table-${index}`);
  const session = asRecord(table.session);
  const order = orders.find((candidate) => candidate.tableId === id);
  const rawStatus = text(table.status).toUpperCase();
  const status: DiningTable["status"] = rawStatus === "AVAILABLE" ? "available" : rawStatus === "RESERVED" ? "attention" : rawStatus === "DISABLED" ? "attention" : order?.status === "READY" ? "ready" : order?.status === "SERVED" ? "bill" : "seated";
  const openedAt = text(session?.openedAt);
  return [{
    id,
    label: text(table.label, `T${number(table.number, index + 1)}`),
    zone: text(table.zone, "Dining room"),
    seats: number(table.capacity, 4),
    guests: number(session?.guestCount),
    status,
    elapsedMinutes: openedAt ? Math.max(0, Math.floor((Date.now() - new Date(openedAt).getTime()) / 60_000)) : 0,
    total: order?.total ?? 0,
    orderId: order?.id,
    waiter: "Assigned waiter",
  }];
});

export const normalizeTickets = (payload: unknown, orders: Order[]): KitchenTicket[] => asArray(payload).flatMap((entry, index) => {
  const ticket = asRecord(entry);
  if (!ticket) return [];
  const orderRecord = asRecord(ticket.order);
  const orderId = text(ticket.orderId ?? orderRecord?.id);
  const linkedOrder = orders.find((order) => order.id === orderId);
  const rawStatus = text(ticket.status, "NEW").toUpperCase();
  const status: KitchenTicket["status"] = rawStatus === "READY" ? "ready" : rawStatus === "PREPARING" ? "preparing" : "new";
  const rawPriority = text(ticket.priority, "NORMAL").toLowerCase();
  const priority: KitchenTicket["priority"] = rawPriority === "rush" ? "rush" : rawPriority === "refire" ? "refire" : "normal";
  const items = lineItems(orderRecord?.items ?? linkedOrder?.items).filter((item) => {
    const ids = asArray(ticket.lineIds).filter((id): id is string => typeof id === "string");
    return !ids.length || ids.includes(item.id);
  });
  return [{
    id: text(ticket.id ?? ticket._id, `ticket-${index}`),
    orderId,
    displayId: text(orderRecord?.orderNumber ?? linkedOrder?.displayId ?? ticket.ticketNumber, `#${index + 1}`),
    tableLabel: linkedOrder?.tableLabel ?? (text(orderRecord?.mode) === "PICKUP" ? `Pickup - ${text(orderRecord?.guestName, "Guest")}` : "Dine in"),
    station: station(ticket.station),
    priority,
    startedAt: text(ticket.acceptedAt ?? ticket.createdAt, new Date().toISOString()),
    status,
    items,
  }];
});
