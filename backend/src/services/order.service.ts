import { Types, type HydratedDocument } from "mongoose";

import type { Permission, Role } from "../domain/access.js";
import {
  canTransitionItem,
  canTransitionOrder,
  roleMaySetItemStatus,
  roleMaySetOrderStatus,
  type OrderItemStatus,
  type OrderMode,
  type OrderStatus
} from "../domain/orderTransitions.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { orderNumber } from "../lib/ids.js";
import { serializeKitchenOrder, serializeOrder, serializeWaiterOrder, serializeTicket } from "../lib/serializers.js";
import { DiningTableModel } from "../models/DiningTable.js";
import { KitchenTicketModel, type KitchenTicketStatus } from "../models/KitchenTicket.js";
import { OrderModel, type Order } from "../models/Order.js";
import { TableSessionModel } from "../models/TableSession.js";
import { recordAudit } from "./audit.service.js";
import { createNotification } from "./notification.service.js";
import { priceOrder, type OrderLineInput } from "./pricing.service.js";
import { getRestaurant } from "./restaurant.service.js";
import { emitToAccount, emitToRole } from "./socket.service.js";

export interface ActorContext {
  accountId: string;
  restaurantId: string;
  role: Role;
  permissions: Permission[];
  tokenVersion: number;
}

export interface CreateOrderInput {
  mode: OrderMode;
  items: OrderLineInput[];
  tableId?: string;
  tableToken?: string;
  tableSessionId?: string;
  guestCount?: number;
  guestName?: string;
  guestPhone?: string;
  draft?: boolean;
}

type OrderDocument = HydratedDocument<Order>;

interface TableContext {
  tableId?: Types.ObjectId;
  tableSessionId?: Types.ObjectId;
}

function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

function hasPermission(actor: ActorContext, permission: Permission): boolean {
  return actor.permissions.includes(permission);
}

function sourceForRole(role: Role): Order["source"] {
  if (role === "CUSTOMER") return "CUSTOMER";
  if (role === "WAITER") return "WAITER";
  if (role === "KITCHEN") throw forbidden("AUTH_FORBIDDEN", "Kitchen accounts cannot create orders");
  return "CASHIER";
}

function sameId(value: Types.ObjectId | undefined, expected: string): boolean {
  return value?.toString() === expected;
}

async function resolveTableContext(actor: ActorContext, input: CreateOrderInput): Promise<TableContext> {
  if (input.mode !== "DINE_IN") {
    if (input.tableId || input.tableToken || input.tableSessionId) {
      throw badRequest("ORDER_TABLE_CONTEXT_INVALID", "Only dine-in orders may include table details");
    }
    return {};
  }

  if (actor.role === "CUSTOMER" && !input.tableToken) {
    throw forbidden("TABLE_INVALID_TOKEN", "Customer dine-in orders require a valid table QR token");
  }

  let table = input.tableToken
    ? await DiningTableModel.findOne({
        restaurantId: actor.restaurantId,
        qrToken: input.tableToken,
        orderingEnabled: true
      }).select("+qrToken")
    : undefined;

  if (input.tableId) {
    const tableById = await DiningTableModel.findOne({ _id: input.tableId, restaurantId: actor.restaurantId });
    if (!tableById) throw notFound("TABLE_NOT_FOUND", "Dining table was not found");
    if (table && table._id.toString() !== tableById._id.toString()) {
      throw badRequest("ORDER_TABLE_CONTEXT_INVALID", "The table identifier does not match the QR token");
    }
    table = tableById;
  }

  if (!table) throw notFound("TABLE_NOT_FOUND", "A valid dining table is required");
  if (table.status === "DISABLED" || !table.orderingEnabled) {
    throw conflict("TABLE_UNAVAILABLE", "This table is not accepting orders");
  }
  if (actor.role === "WAITER" && table.assignedWaiterId && !sameId(table.assignedWaiterId, actor.accountId)) {
    throw forbidden("TABLE_NOT_ASSIGNED", "This table is assigned to another waiter");
  }

  let session = input.tableSessionId
    ? await TableSessionModel.findOne({
        _id: input.tableSessionId,
        restaurantId: actor.restaurantId,
        tableId: table._id,
        status: "OPEN"
      })
    : await TableSessionModel.findOne({ restaurantId: actor.restaurantId, tableId: table._id, status: "OPEN" });

  if (input.tableSessionId && !session) {
    throw conflict("TABLE_SESSION_NOT_OPEN", "The selected table session is not active");
  }

  if (!session) {
    const guestCount = input.guestCount ?? 1;
    if (guestCount > table.capacity) {
      throw conflict("TABLE_CAPACITY_EXCEEDED", `This table seats up to ${table.capacity} guests`);
    }
    session = await TableSessionModel.create({
      restaurantId: toObjectId(actor.restaurantId),
      tableId: table._id,
      openedByAccountId: toObjectId(actor.accountId),
      guestCount,
      status: "OPEN"
    });
    table.status = "OCCUPIED";
    await table.save();
  }

  return { tableId: table._id, tableSessionId: session._id };
}

function broadcastOrder(event: "order:created" | "order:updated", order: OrderDocument): void {
  const restaurantId = order.restaurantId.toString();
  emitToRole(restaurantId, "CASHIER", event, serializeOrder(order));
  emitToRole(restaurantId, "WAITER", event, serializeWaiterOrder(order));
  emitToRole(restaurantId, "KITCHEN", event, serializeKitchenOrder(order));
  if (order.customerId) emitToAccount(restaurantId, order.customerId.toString(), event, serializeOrder(order));
}

export async function createKitchenTickets(order: OrderDocument): Promise<void> {
  const byStation = new Map<string, string[]>();
  for (const item of order.items) {
    const lineIds = byStation.get(item.station) ?? [];
    lineIds.push(item.lineId);
    byStation.set(item.station, lineIds);
  }

  const tickets = await Promise.all(
    [...byStation.entries()].map(([station, lineIds], index) =>
      KitchenTicketModel.create({
        restaurantId: order.restaurantId,
        orderId: order._id,
        ticketNumber: `${order.orderNumber}-${index + 1}`,
        station,
        lineIds,
        status: "NEW"
      })
    )
  );

  for (const ticket of tickets) {
    emitToRole(order.restaurantId.toString(), "KITCHEN", "ticket:created", serializeTicket(ticket));
  }
}

export async function createOrder(actor: ActorContext, input: CreateOrderInput) {
  const restaurant = await getRestaurant(actor.restaurantId);
  if (!restaurant.orderingModes.includes(input.mode)) {
    throw badRequest("ORDER_MODE_DISABLED", "This ordering mode is not enabled by the restaurant");
  }
  if (input.mode === "PICKUP" && actor.role === "CUSTOMER" && (!input.guestName || !input.guestPhone)) {
    throw badRequest("PICKUP_CONTACT_REQUIRED", "Pickup orders require a customer name and phone number");
  }

  const source = sourceForRole(actor.role);
  const tableContext = await resolveTableContext(actor, input);
  const quote = await priceOrder(restaurant, input.items);
  const isDraft = input.draft === true && actor.role !== "CUSTOMER";
  const status: OrderStatus = isDraft ? "DRAFT" : "PLACED";
  const timestamp = new Date();
  const timeline: Order["timeline"] = [
    {
      type: "ORDER_CREATED",
      newStatus: isDraft ? "DRAFT" : "PLACED",
      timestamp,
      actorId: toObjectId(actor.accountId),
      actorRole: actor.role,
      source: "API"
    }
  ];

  if (!isDraft) {
    timeline.push({
      type: "ORDER_PLACED",
      previousStatus: "DRAFT",
      newStatus: "PLACED",
      timestamp,
      actorId: toObjectId(actor.accountId),
      actorRole: actor.role,
      source: "API"
    });
  }

  const order = await OrderModel.create({
    restaurantId: restaurant._id,
    orderNumber: orderNumber(restaurant.invoicePrefix),
    mode: input.mode,
    ...tableContext,
    ...(actor.role === "CUSTOMER" ? { customerId: toObjectId(actor.accountId) } : {}),
    createdByAccountId: toObjectId(actor.accountId),
    ...(input.guestName ? { guestName: input.guestName } : {}),
    ...(input.guestPhone ? { guestPhone: input.guestPhone } : {}),
    status,
    paymentStatus: "UNPAID",
    items: quote.items,
    pricing: quote.pricing,
    timeline,
    source
  });

  if (!isDraft) await createKitchenTickets(order);
  broadcastOrder("order:created", order);
  await recordAudit({
    restaurantId: actor.restaurantId,
    actorId: actor.accountId,
    actorRole: actor.role,
    action: "ORDER_CREATED",
    entityType: "Order",
    entityId: order._id.toString(),
    after: { status: order.status, totalPaise: order.pricing.grandTotalPaise, mode: order.mode }
  });
  return order;
}

export function assertOrderAccess(order: OrderDocument, actor: ActorContext): void {
  if (order.restaurantId.toString() !== actor.restaurantId) {
    throw notFound("ORDER_NOT_FOUND", "Order was not found");
  }
  if (actor.role === "CUSTOMER" && !sameId(order.customerId, actor.accountId)) {
    throw notFound("ORDER_NOT_FOUND", "Order was not found");
  }
  if (actor.role === "KITCHEN" && !["PLACED", "CONFIRMED", "ACCEPTED_BY_KITCHEN", "PREPARING", "PARTIALLY_READY", "READY"].includes(order.status)) {
    throw forbidden("ORDER_NOT_AVAILABLE", "This order is not available to the kitchen");
  }
}

export async function findOrderForActor(orderId: string, actor: ActorContext) {
  const order = await OrderModel.findOne({ _id: orderId, restaurantId: actor.restaurantId });
  if (!order) throw notFound("ORDER_NOT_FOUND", "Order was not found");
  assertOrderAccess(order, actor);
  return order;
}

function assertExpectedVersion(order: Order, expectedVersion: number | undefined): void {
  if (expectedVersion !== undefined && order.version !== expectedVersion) {
    throw conflict("ORDER_VERSION_CONFLICT", "This order has changed; refresh before retrying", {
      expectedVersion,
      currentVersion: order.version
    });
  }
}

function appendStatusEvent(order: Order, actor: ActorContext, previousStatus: OrderStatus, newStatus: OrderStatus, note?: string): void {
  order.timeline.push({
    type: "ORDER_STATUS_CHANGED",
    previousStatus,
    newStatus,
    timestamp: new Date(),
    actorId: toObjectId(actor.accountId),
    actorRole: actor.role,
    ...(note ? { note } : {}),
    source: "API"
  });
}

function derivedOrderStatus(order: Order): OrderStatus | undefined {
  const activeItems = order.items.filter((item) => item.status !== "CANCELLED");
  if (activeItems.length === 0) return undefined;
  if (activeItems.every((item) => item.status === "SERVED")) return "SERVED";
  if (activeItems.every((item) => item.status === "READY" || item.status === "SERVED")) return "READY";
  if (activeItems.some((item) => item.status === "READY" || item.status === "SERVED")) return "PARTIALLY_READY";
  if (activeItems.some((item) => item.status === "PREPARING")) return "PREPARING";
  if (activeItems.some((item) => item.status === "QUEUED")) return "ACCEPTED_BY_KITCHEN";
  return undefined;
}

async function synchronizeTickets(order: OrderDocument): Promise<void> {
  const tickets = await KitchenTicketModel.find({ restaurantId: order.restaurantId, orderId: order._id });
  for (const ticket of tickets) {
    const ticketItems = order.items.filter((item) => ticket.lineIds.includes(item.lineId));
    let status: KitchenTicketStatus = ticket.status;
    if (order.status === "CANCELLED" || (ticketItems.length > 0 && ticketItems.every((item) => item.status === "CANCELLED"))) status = "CANCELLED";
    else if (ticketItems.length > 0 && ticketItems.every((item) => item.status === "SERVED")) status = "COMPLETED";
    else if (ticketItems.length > 0 && ticketItems.every((item) => item.status === "READY" || item.status === "SERVED")) status = "READY";
    else if (ticketItems.some((item) => item.status === "PREPARING")) status = "PREPARING";

    if (status !== ticket.status) {
      ticket.status = status;
      if (status === "READY") ticket.readyAt = new Date();
      await ticket.save();
      emitToRole(order.restaurantId.toString(), "KITCHEN", "ticket:updated", serializeTicket(ticket));
    }
  }
}

async function publishOrderUpdate(order: OrderDocument, actor: ActorContext, action: string): Promise<void> {
  broadcastOrder("order:updated", order);
  await recordAudit({
    restaurantId: actor.restaurantId,
    actorId: actor.accountId,
    actorRole: actor.role,
    action,
    entityType: "Order",
    entityId: order._id.toString(),
    after: { status: order.status, paymentStatus: order.paymentStatus, version: order.version }
  });
}

export async function transitionOrder(
  order: OrderDocument,
  actor: ActorContext,
  input: { status: OrderStatus; note?: string; expectedVersion?: number }
) {
  assertOrderAccess(order, actor);
  assertExpectedVersion(order, input.expectedVersion);
  if (!roleMaySetOrderStatus(actor.role, input.status)) {
    throw forbidden("AUTH_FORBIDDEN", "Your role cannot make this order transition");
  }
  if (!canTransitionOrder(order.status, input.status)) {
    throw conflict("ORDER_INVALID_TRANSITION", `Cannot transition order from ${order.status} to ${input.status}`);
  }
  if (input.status === "CANCELLED" && !hasPermission(actor, "canCancelOrder")) {
    throw forbidden("AUTH_MISSING_PERMISSION", "Cancelling an order requires permission");
  }
  if (input.status === "CANCELLED" && ["PAID", "PARTIALLY_PAID"].includes(order.paymentStatus)) {
    throw conflict("ORDER_ALREADY_PAID", "Settle any required refund before cancelling a paid order");
  }
  if ((input.status === "CANCEL_REQUESTED" || input.status === "CANCELLED") && !input.note) {
    throw badRequest("CANCELLATION_REASON_REQUIRED", "A cancellation reason is required");
  }

  const previousStatus = order.status;
  order.status = input.status;
  if (input.status === "SERVED") {
    for (const item of order.items) {
      if (item.status === "READY") item.status = "SERVED";
    }
  }
  appendStatusEvent(order, actor, previousStatus, input.status, input.note);
  if (input.status === "CANCELLED") {
    for (const item of order.items) {
      if (item.status !== "SERVED") item.status = "CANCELLED";
    }
  }
  await order.save();
  await synchronizeTickets(order);
  await publishOrderUpdate(order, actor, "ORDER_STATUS_CHANGED");

  if (input.status === "READY" || input.status === "PARTIALLY_READY") {
    await createNotification({
      restaurantId: actor.restaurantId,
      role: "WAITER",
      type: "ORDER_READY",
      title: "Order ready",
      message: `${order.orderNumber} has items ready to serve`,
      entityType: "Order",
      entityId: order._id.toString()
    });
  }
  return order;
}

export async function transitionOrderItem(
  order: OrderDocument,
  actor: ActorContext,
  input: { lineId: string; status: OrderItemStatus; note?: string; expectedVersion?: number }
) {
  assertOrderAccess(order, actor);
  assertExpectedVersion(order, input.expectedVersion);
  const item = order.items.find((entry) => entry.lineId === input.lineId);
  if (!item) throw notFound("ORDER_ITEM_NOT_FOUND", "Order item was not found");
  if (!roleMaySetItemStatus(actor.role, input.status)) {
    throw forbidden("AUTH_FORBIDDEN", "Your role cannot update this item status");
  }
  if (input.status === "CANCELLED" && !hasPermission(actor, "canCancelOrder")) {
    throw forbidden("AUTH_MISSING_PERMISSION", "Cancelling an item requires permission");
  }
  if (!canTransitionItem(item.status, input.status)) {
    throw conflict("ORDER_INVALID_ITEM_TRANSITION", `Cannot transition item from ${item.status} to ${input.status}`);
  }

  const previousItemStatus = item.status;
  item.status = input.status;
  order.timeline.push({
    type: "ORDER_ITEM_STATUS_CHANGED",
    timestamp: new Date(),
    actorId: toObjectId(actor.accountId),
    actorRole: actor.role,
    note: `${item.name}: ${previousItemStatus} → ${input.status}${input.note ? ` — ${input.note}` : ""}`,
    source: "API"
  });

  const derived = derivedOrderStatus(order);
  if (derived && derived !== order.status && canTransitionOrder(order.status, derived)) {
    const previousStatus = order.status;
    order.status = derived;
    appendStatusEvent(order, actor, previousStatus, derived);
  }
  await order.save();
  await synchronizeTickets(order);
  await publishOrderUpdate(order, actor, "ORDER_ITEM_STATUS_CHANGED");

  if (input.status === "READY") {
    emitToRole(actor.restaurantId, "WAITER", "item:ready", { orderId: order._id.toString(), lineId: item.lineId });
    await createNotification({
      restaurantId: actor.restaurantId,
      role: "WAITER",
      type: "ITEM_READY",
      title: "Item ready",
      message: `${item.name} from ${order.orderNumber} is ready`,
      entityType: "Order",
      entityId: order._id.toString()
    });
  }
  return order;
}

export async function markTicketsCancelled(order: OrderDocument): Promise<void> {
  await KitchenTicketModel.updateMany(
    { restaurantId: order.restaurantId, orderId: order._id, status: { $ne: "COMPLETED" } },
    { $set: { status: "CANCELLED" } }
  );
}
