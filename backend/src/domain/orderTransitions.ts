import type { Role } from "./access.js";

export const ORDER_STATUSES = [
  "DRAFT",
  "PLACED",
  "CONFIRMED",
  "ACCEPTED_BY_KITCHEN",
  "PREPARING",
  "PARTIALLY_READY",
  "READY",
  "SERVED",
  "COMPLETED",
  "CANCEL_REQUESTED",
  "CANCELLED",
  "REJECTED"
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_ITEM_STATUSES = ["PENDING", "QUEUED", "PREPARING", "READY", "SERVED", "CANCELLED"] as const;
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];

export const ORDER_MODES = ["DINE_IN", "PICKUP", "COUNTER"] as const;
export type OrderMode = (typeof ORDER_MODES)[number];

export const PAYMENT_STATUSES = [
  "UNPAID",
  "PAYMENT_PENDING",
  "PARTIALLY_PAID",
  "PAID",
  "PAYMENT_FAILED",
  "REFUND_PENDING",
  "PARTIALLY_REFUNDED",
  "REFUNDED"
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  DRAFT: ["PLACED", "CANCELLED"],
  PLACED: ["CONFIRMED", "CANCEL_REQUESTED", "CANCELLED", "REJECTED"],
  CONFIRMED: ["ACCEPTED_BY_KITCHEN", "CANCEL_REQUESTED", "CANCELLED"],
  ACCEPTED_BY_KITCHEN: ["PREPARING", "CANCEL_REQUESTED"],
  PREPARING: ["PARTIALLY_READY", "READY", "CANCEL_REQUESTED"],
  PARTIALLY_READY: ["READY", "CANCEL_REQUESTED"],
  READY: ["SERVED", "CANCEL_REQUESTED"],
  SERVED: ["COMPLETED"],
  COMPLETED: [],
  CANCEL_REQUESTED: ["CANCELLED", "PREPARING", "READY"],
  CANCELLED: [],
  REJECTED: []
};

export const ITEM_TRANSITIONS: Readonly<Record<OrderItemStatus, readonly OrderItemStatus[]>> = {
  PENDING: ["QUEUED", "PREPARING", "CANCELLED"],
  QUEUED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED", "CANCELLED"],
  SERVED: [],
  CANCELLED: []
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function canTransitionItem(from: OrderItemStatus, to: OrderItemStatus): boolean {
  return ITEM_TRANSITIONS[from].includes(to);
}

export function roleMaySetOrderStatus(role: Role, status: OrderStatus): boolean {
  const permitted: Record<OrderStatus, readonly Role[]> = {
    DRAFT: ["WAITER", "CASHIER"],
    PLACED: ["CUSTOMER", "WAITER", "CASHIER"],
    CONFIRMED: ["CASHIER"],
    ACCEPTED_BY_KITCHEN: ["KITCHEN"],
    PREPARING: ["KITCHEN"],
    PARTIALLY_READY: ["KITCHEN"],
    READY: ["KITCHEN"],
    SERVED: ["WAITER", "CASHIER"],
    COMPLETED: ["CASHIER"],
    CANCEL_REQUESTED: ["CUSTOMER", "WAITER", "CASHIER"],
    CANCELLED: ["CASHIER"],
    REJECTED: ["CASHIER"]
  };
  return permitted[status].includes(role);
}

export function roleMaySetItemStatus(role: Role, status: OrderItemStatus): boolean {
  if (status === "SERVED") return role === "WAITER" || role === "CASHIER";
  if (status === "CANCELLED") return role === "CASHIER";
  return role === "KITCHEN";
}
