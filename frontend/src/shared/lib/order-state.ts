import type { OrderStatus, PaymentStatus } from "@/shared/types/domain";

/**
 * Centralised state groups keep queues, badges and navigation from treating a
 * cancelled or completed order as operational work.
 */
export const terminalOrderStatuses = new Set<OrderStatus>([
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
]);

export const activeOrderStatuses = new Set<OrderStatus>([
  "DRAFT",
  "PLACED",
  "CONFIRMED",
  "ACCEPTED_BY_KITCHEN",
  "PREPARING",
  "PARTIALLY_READY",
  "READY",
  "SERVED",
  "CANCEL_REQUESTED",
]);

export const settledPaymentStatuses = new Set<PaymentStatus>([
  "PAID",
  "REFUNDED",
]);

export const needsPaymentAttention = (status: PaymentStatus): boolean =>
  !settledPaymentStatuses.has(status);

export const isTerminalOrder = (status: OrderStatus): boolean =>
  terminalOrderStatuses.has(status);

export const isActiveOrder = (status: OrderStatus): boolean =>
  activeOrderStatuses.has(status);
