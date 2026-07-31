import { createHmac, timingSafeEqual } from "node:crypto";

import { Types, type HydratedDocument } from "mongoose";
import Razorpay from "razorpay";

import { env } from "../config/env.js";
import type { Role } from "../domain/access.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { serializeOrder, serializePayment } from "../lib/serializers.js";
import { OrderModel, type Order } from "../models/Order.js";
import { PaymentModel, type Payment } from "../models/Payment.js";
import { ShiftModel } from "../models/Shift.js";
import { recordAudit } from "./audit.service.js";
import { findOrderForActor, type ActorContext } from "./order.service.js";
import { emitToAccount, emitToRole } from "./socket.service.js";

type IdentifiedOrder = HydratedDocument<Order>;
type IdentifiedPayment = HydratedDocument<Payment>;

function razorpayClient(): Razorpay {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw conflict("PAYMENT_PROVIDER_NOT_CONFIGURED", "Razorpay is not configured for this environment");
  }
  return new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
}

function addPaymentTimeline(order: Order, actorId: string | undefined, role: Role | undefined, type: string, note: string, source: "API" | "WEBHOOK" = "API"): void {
  order.timeline.push({
    type,
    timestamp: new Date(),
    ...(actorId ? { actorId: new Types.ObjectId(actorId) } : {}),
    ...(role ? { actorRole: role } : {}),
    note,
    source
  });
}

async function outstandingBalance(order: IdentifiedOrder): Promise<number> {
  const payments = await PaymentModel.find({ restaurantId: order.restaurantId, orderId: order._id, status: "PAID" });
  const paidPaise = payments.reduce((total, payment) => total + payment.amountPaise - payment.refundAmountPaise, 0);
  return Math.max(0, order.pricing.grandTotalPaise - paidPaise);
}

function publishPayment(payment: IdentifiedPayment): void {
  emitToRole(payment.restaurantId.toString(), "CASHIER", "payment:updated", serializePayment(payment));
}

async function publishOrderPaymentUpdate(order: IdentifiedOrder, actor: ActorContext, action: string): Promise<void> {
  const restaurantId = order.restaurantId.toString();
  emitToRole(restaurantId, "CASHIER", "order:updated", serializeOrder(order));
  if (order.customerId) emitToAccount(restaurantId, order.customerId.toString(), "order:updated", serializeOrder(order));
  await recordAudit({
    restaurantId: actor.restaurantId,
    actorId: actor.accountId,
    actorRole: actor.role,
    action,
    entityType: "Order",
    entityId: order._id.toString(),
    after: { paymentStatus: order.paymentStatus, totalPaise: order.pricing.grandTotalPaise }
  });
}

async function acquirePaymentLock(order: IdentifiedOrder) {
  const locked = await OrderModel.findOneAndUpdate(
    {
      _id: order._id,
      restaurantId: order.restaurantId,
      paymentStatus: { $in: ["UNPAID", "PAYMENT_FAILED"] }
    },
    { $set: { paymentStatus: "PAYMENT_PENDING" } },
    { new: true }
  );
  if (!locked) throw conflict("PAYMENT_PENDING", "A payment is already in progress or this order has been settled");
  return locked;
}

async function releasePaymentLock(order: IdentifiedOrder): Promise<void> {
  await OrderModel.updateOne(
    { _id: order._id, restaurantId: order.restaurantId, paymentStatus: "PAYMENT_PENDING" },
    { $set: { paymentStatus: "UNPAID" } }
  );
}

export async function takeCashPayment(actor: ActorContext, orderId: string, cashReceivedPaise: number) {
  if (actor.role !== "CASHIER") throw forbidden();
  const openShift = await ShiftModel.findOne({ restaurantId: actor.restaurantId, cashierId: actor.accountId, status: "OPEN" });
  if (!openShift) throw conflict("SHIFT_NOT_OPEN", "Open a cashier shift before accepting cash");
  const order = await findOrderForActor(orderId, actor);
  const duePaise = await outstandingBalance(order);
  if (duePaise <= 0 || order.paymentStatus === "PAID") throw conflict("ORDER_ALREADY_PAID", "This order has no outstanding balance");
  if (cashReceivedPaise < duePaise) {
    throw badRequest("PAYMENT_AMOUNT_INSUFFICIENT", "Cash received is lower than the outstanding balance", { duePaise });
  }
  const lockedOrder = await acquirePaymentLock(order);
  try {
    const payment = await PaymentModel.create({
      restaurantId: lockedOrder.restaurantId,
      orderId: lockedOrder._id,
      provider: "CASH",
      status: "PAID",
      amountPaise: duePaise,
      currency: lockedOrder.pricing.currency,
      cashReceivedPaise,
      changePaise: cashReceivedPaise - duePaise,
      refundAmountPaise: 0,
      createdByAccountId: new Types.ObjectId(actor.accountId)
    });
    lockedOrder.paymentStatus = "PAID";
    addPaymentTimeline(lockedOrder, actor.accountId, actor.role, "CASH_PAYMENT_CAPTURED", `Cash payment of ${duePaise} paise captured`);
    await lockedOrder.save();
    openShift.cashSalesPaise += duePaise;
    await openShift.save();
    publishPayment(payment);
    await publishOrderPaymentUpdate(lockedOrder, actor, "CASH_PAYMENT_CAPTURED");
    return { payment, order: lockedOrder, duePaise, changePaise: cashReceivedPaise - duePaise };
  } catch (error) {
    await releasePaymentLock(lockedOrder);
    throw error;
  }
}

export async function createRazorpayOrder(actor: ActorContext, orderId: string) {
  if (actor.role !== "CUSTOMER" && actor.role !== "CASHIER") throw forbidden();
  const order = await findOrderForActor(orderId, actor);
  const duePaise = await outstandingBalance(order);
  if (duePaise <= 0 || order.paymentStatus === "PAID") throw conflict("ORDER_ALREADY_PAID", "This order has no outstanding balance");
  const lockedOrder = await acquirePaymentLock(order);
  let providerOrder: { id: string; amount: number; currency: string } | undefined;
  try {
    const providerResponse = await razorpayClient().orders.create({
      amount: duePaise,
      currency: lockedOrder.pricing.currency,
      receipt: lockedOrder.orderNumber.slice(0, 40),
      notes: { orderId: lockedOrder._id.toString(), orderNumber: lockedOrder.orderNumber }
    });
    providerOrder = {
      id: providerResponse.id,
      amount: Number(providerResponse.amount),
      currency: providerResponse.currency
    };
    if (providerOrder.amount !== duePaise || providerOrder.currency !== lockedOrder.pricing.currency) {
      throw conflict("PAYMENT_AMOUNT_MISMATCH", "The payment provider returned an invalid amount");
    }
    const payment = await PaymentModel.create({
      restaurantId: lockedOrder.restaurantId,
      orderId: lockedOrder._id,
      provider: "RAZORPAY",
      status: "PENDING",
      amountPaise: duePaise,
      currency: lockedOrder.pricing.currency,
      providerOrderId: providerOrder.id,
      refundAmountPaise: 0,
      createdByAccountId: new Types.ObjectId(actor.accountId)
    });
    addPaymentTimeline(lockedOrder, actor.accountId, actor.role, "RAZORPAY_PAYMENT_CREATED", `Razorpay order ${providerOrder.id} created`);
    await lockedOrder.save();
    publishPayment(payment);
    await publishOrderPaymentUpdate(lockedOrder, actor, "RAZORPAY_PAYMENT_CREATED");
    return { payment, razorpayOrder: providerOrder, keyId: env.RAZORPAY_KEY_ID };
  } catch (error) {
    await releasePaymentLock(lockedOrder);
    if (error instanceof Error && "code" in error) throw error;
    throw conflict("PAYMENT_CREATION_FAILED", "Unable to start the Razorpay payment");
  }
}

function validSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const expected = createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
  const provided = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return provided.length === expectedBuffer.length && timingSafeEqual(provided, expectedBuffer);
}

export async function verifyRazorpayPayment(
  actor: ActorContext,
  input: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }
) {
  if (!validSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature)) {
    throw badRequest("PAYMENT_SIGNATURE_INVALID", "Razorpay payment signature could not be verified");
  }
  const payment = await PaymentModel.findOne({ restaurantId: actor.restaurantId, provider: "RAZORPAY", providerOrderId: input.razorpayOrderId });
  if (!payment) throw notFound("PAYMENT_NOT_FOUND", "Payment attempt was not found");
  const order = await findOrderForActor(payment.orderId.toString(), actor);
  if (payment.status === "PAID") return { payment, order, alreadyVerified: true };
  if (payment.status !== "PENDING") throw conflict("PAYMENT_NOT_PENDING", "This payment cannot be completed");
  if (payment.amountPaise !== order.pricing.grandTotalPaise) {
    throw conflict("PAYMENT_AMOUNT_MISMATCH", "The payment amount no longer matches the order total");
  }
  payment.status = "PAID";
  payment.providerPaymentId = input.razorpayPaymentId;
  await payment.save();
  order.paymentStatus = "PAID";
  addPaymentTimeline(order, actor.accountId, actor.role, "RAZORPAY_PAYMENT_VERIFIED", `Razorpay payment ${input.razorpayPaymentId} verified`);
  await order.save();
  publishPayment(payment);
  await publishOrderPaymentUpdate(order, actor, "RAZORPAY_PAYMENT_VERIFIED");
  return { payment, order, alreadyVerified: false };
}

export async function refundPayment(actor: ActorContext, paymentId: string, refundAmountPaise?: number) {
  if (actor.role !== "CASHIER" || !actor.permissions.includes("canRefundPayment")) {
    throw forbidden("AUTH_MISSING_PERMISSION", "Refunding payments requires permission");
  }
  const payment = await PaymentModel.findOne({ _id: paymentId, restaurantId: actor.restaurantId });
  if (!payment) throw notFound("PAYMENT_NOT_FOUND", "Payment was not found");
  const order = await OrderModel.findOne({ _id: payment.orderId, restaurantId: actor.restaurantId });
  if (!order) throw notFound("ORDER_NOT_FOUND", "Order was not found");
  if (payment.status === "REFUNDED") return { payment, order, alreadyRefunded: true };
  if (payment.status !== "PAID") throw conflict("REFUND_NOT_ALLOWED", "Only paid payments can be refunded");
  const amountPaise = refundAmountPaise ?? payment.amountPaise - payment.refundAmountPaise;
  if (amountPaise <= 0 || amountPaise > payment.amountPaise - payment.refundAmountPaise) {
    throw badRequest("REFUND_NOT_ALLOWED", "Refund amount is invalid");
  }
  if (payment.provider === "RAZORPAY") {
    if (!payment.providerPaymentId) throw conflict("REFUND_NOT_ALLOWED", "Provider payment identifier is missing");
    try {
      await razorpayClient().payments.refund(payment.providerPaymentId, { amount: amountPaise });
    } catch {
      throw conflict("REFUND_NOT_ALLOWED", "Razorpay could not process this refund");
    }
  }
  payment.refundAmountPaise += amountPaise;
  payment.status = payment.refundAmountPaise === payment.amountPaise ? "REFUNDED" : "PAID";
  await payment.save();
  if (payment.provider === "CASH" && payment.createdByAccountId && payment.createdAt) {
    const shift = await ShiftModel.findOne({
      restaurantId: actor.restaurantId,
      cashierId: payment.createdByAccountId,
      openedAt: { $lte: payment.createdAt },
      $or: [{ status: "OPEN" }, { closedAt: { $gte: payment.createdAt } }]
    }).sort({ openedAt: -1 });
    if (shift) {
      shift.cashSalesPaise = Math.max(0, shift.cashSalesPaise - amountPaise);
      if (shift.status === "CLOSED") shift.expectedCashPaise = shift.openingCashPaise + shift.cashSalesPaise;
      await shift.save();
    }
  }
  const paidPayments = await PaymentModel.find({ restaurantId: actor.restaurantId, orderId: order._id, status: "PAID" });
  const remainingPaid = paidPayments.reduce((total, item) => total + item.amountPaise - item.refundAmountPaise, 0);
  order.paymentStatus = remainingPaid === 0 ? "REFUNDED" : "PARTIALLY_REFUNDED";
  addPaymentTimeline(order, actor.accountId, actor.role, "PAYMENT_REFUNDED", `Refunded ${amountPaise} paise`);
  await order.save();
  publishPayment(payment);
  await publishOrderPaymentUpdate(order, actor, "PAYMENT_REFUNDED");
  return { payment, order, alreadyRefunded: false };
}

export async function handleRazorpayWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) throw forbidden("PAYMENT_SIGNATURE_INVALID", "Webhook signature is missing");
  const expected = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");
  if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) {
    throw forbidden("PAYMENT_SIGNATURE_INVALID", "Webhook signature is invalid");
  }
  const payload = JSON.parse(rawBody.toString("utf8")) as {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string } } };
  };
  const entity = payload.payload?.payment?.entity;
  const providerOrderId = entity?.order_id;
  if (!providerOrderId) return;
  const payment = await PaymentModel.findOne({ provider: "RAZORPAY", providerOrderId });
  if (!payment) return;
  const order = await OrderModel.findById(payment.orderId);
  if (!order) return;

  if (payload.event === "payment.captured") {
    if (payment.status === "PAID") return;
    if (payment.status !== "PENDING" || entity?.amount !== payment.amountPaise || entity.currency !== payment.currency || !entity.id) {
      payment.status = "FAILED";
      await payment.save();
      publishPayment(payment);
      return;
    }
    payment.status = "PAID";
    payment.providerPaymentId = entity.id;
    await payment.save();
    order.paymentStatus = "PAID";
    addPaymentTimeline(order, undefined, undefined, "RAZORPAY_PAYMENT_CAPTURED_WEBHOOK", `Razorpay payment ${entity.id} captured`, "WEBHOOK");
    await order.save();
    emitToRole(order.restaurantId.toString(), "CASHIER", "order:updated", serializeOrder(order));
    if (order.customerId) emitToAccount(order.restaurantId.toString(), order.customerId.toString(), "order:updated", serializeOrder(order));
    publishPayment(payment);
    return;
  }
  if (payload.event === "payment.failed" && payment.status === "PENDING") {
    payment.status = "FAILED";
    await payment.save();
    if (order.paymentStatus === "PAYMENT_PENDING") {
      order.paymentStatus = "PAYMENT_FAILED";
      addPaymentTimeline(order, undefined, undefined, "RAZORPAY_PAYMENT_FAILED", `Razorpay payment ${providerOrderId} failed`, "WEBHOOK");
      await order.save();
      emitToRole(order.restaurantId.toString(), "CASHIER", "order:updated", serializeOrder(order));
      if (order.customerId) emitToAccount(order.restaurantId.toString(), order.customerId.toString(), "order:updated", serializeOrder(order));
    }
    publishPayment(payment);
  }
}
