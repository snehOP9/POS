export const USER_ROLES = ["CUSTOMER", "WAITER", "KITCHEN", "CASHIER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

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

export const ORDER_MODES = ["DINE_IN", "PICKUP", "COUNTER"] as const;
export type OrderMode = (typeof ORDER_MODES)[number];

export interface OrderLineInput {
  menuItemId: string;
  quantity: number;
  variantId?: string;
  modifierOptionIds?: string[];
  note?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

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
