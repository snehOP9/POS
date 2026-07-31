import { conflict, forbidden, notFound } from "../lib/errors.js";
import { serializeOrder } from "../lib/serializers.js";
import { OrderModel } from "../models/Order.js";
import { recordAudit } from "./audit.service.js";
import { findOrderForActor, type ActorContext } from "./order.service.js";
import { repriceDiscount } from "./pricing.service.js";
import { getRestaurant } from "./restaurant.service.js";
import { emitToRole } from "./socket.service.js";

function assertCashier(actor: ActorContext, permission?: "canApplyDiscount" | "canCancelOrder" | "canViewReports"): void {
  if (actor.role !== "CASHIER") throw forbidden();
  if (permission && !actor.permissions.includes(permission)) {
    throw forbidden("AUTH_MISSING_PERMISSION", "Your account lacks the required cashier permission");
  }
}

export async function applyOrderDiscount(actor: ActorContext, orderId: string, discountPaise: number, reason: string, expectedVersion?: number) {
  assertCashier(actor, "canApplyDiscount");
  const order = await findOrderForActor(orderId, actor);
  if (["PAID", "PARTIALLY_PAID"].includes(order.paymentStatus)) {
    throw conflict("ORDER_ALREADY_PAID", "A paid order cannot be discounted");
  }
  if (expectedVersion !== undefined && order.version !== expectedVersion) {
    throw conflict("ORDER_VERSION_CONFLICT", "This order changed; refresh before applying a discount");
  }
  const restaurant = await getRestaurant(actor.restaurantId);
  const previousDiscountPaise = order.pricing.discountPaise;
  order.pricing = repriceDiscount(restaurant, order.items, discountPaise);
  order.timeline.push({
    type: "DISCOUNT_APPLIED",
    timestamp: new Date(),
    actorId: order.createdByAccountId,
    actorRole: actor.role,
    note: `${discountPaise} paise discount: ${reason}`,
    source: "API"
  });
  await order.save();
  emitToRole(actor.restaurantId, "CASHIER", "order:updated", serializeOrder(order));
  await recordAudit({
    restaurantId: actor.restaurantId,
    actorId: actor.accountId,
    actorRole: actor.role,
    action: "ORDER_DISCOUNT_APPLIED",
    entityType: "Order",
    entityId: order._id.toString(),
    before: { discountPaise: previousDiscountPaise },
    after: { discountPaise, totalPaise: order.pricing.grandTotalPaise },
    metadata: { reason }
  });
  return order;
}

export async function cashierOrderList(actor: ActorContext, status?: string, page = 1, limit = 25) {
  assertCashier(actor);
  const filter = { restaurantId: actor.restaurantId, ...(status ? { status } : {}) };
  const [orders, total] = await Promise.all([
    OrderModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    OrderModel.countDocuments(filter)
  ]);
  return { orders: orders.map(serializeOrder), total, page, limit };
}

export async function orderReceipt(actor: ActorContext, orderId: string) {
  assertCashier(actor);
  const order = await OrderModel.findOne({ _id: orderId, restaurantId: actor.restaurantId });
  if (!order) throw notFound("ORDER_NOT_FOUND", "Order was not found");
  return serializeOrder(order);
}
