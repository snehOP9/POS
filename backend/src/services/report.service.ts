import { forbidden } from "../lib/errors.js";
import { OrderModel } from "../models/Order.js";
import { PaymentModel } from "../models/Payment.js";
import type { ActorContext } from "./order.service.js";

export async function reportSummary(actor: ActorContext, from: Date, to: Date) {
  if (actor.role !== "CASHIER" || !actor.permissions.includes("canViewReports")) {
    throw forbidden("AUTH_MISSING_PERMISSION", "Viewing reports requires permission");
  }
  const dateFilter = { $gte: from, $lte: to };
  const [orders, payments] = await Promise.all([
    OrderModel.find({ restaurantId: actor.restaurantId, createdAt: dateFilter }),
    PaymentModel.find({ restaurantId: actor.restaurantId, createdAt: dateFilter, status: { $in: ["PAID", "REFUNDED"] } })
  ]);
  const activeOrders = orders.filter((order) => !["CANCELLED", "REJECTED"].includes(order.status));
  const totalSalesPaise = activeOrders.reduce((total, order) => total + order.pricing.grandTotalPaise, 0);
  const paidPaise = payments.reduce((total, payment) => total + payment.amountPaise - payment.refundAmountPaise, 0);
  const refundedPaise = payments.reduce((total, payment) => total + payment.refundAmountPaise, 0);
  const byMode = activeOrders.reduce<Record<string, number>>((result, order) => {
    result[order.mode] = (result[order.mode] ?? 0) + order.pricing.grandTotalPaise;
    return result;
  }, {});
  const byProvider = payments.reduce<Record<string, number>>((result, payment) => {
    result[payment.provider] = (result[payment.provider] ?? 0) + payment.amountPaise - payment.refundAmountPaise;
    return result;
  }, {});
  return {
    from,
    to,
    orderCount: activeOrders.length,
    totalSalesPaise,
    paidPaise,
    refundedPaise,
    averageOrderPaise: activeOrders.length ? Math.round(totalSalesPaise / activeOrders.length) : 0,
    byMode,
    byProvider
  };
}
