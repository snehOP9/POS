import { conflict, forbidden, notFound } from "../lib/errors.js";
import { serializeKitchenOrder, serializeTicket } from "../lib/serializers.js";
import { KitchenTicketModel, type KitchenTicketStatus } from "../models/KitchenTicket.js";
import { OrderModel } from "../models/Order.js";
import {
  assertOrderAccess,
  transitionOrder,
  transitionOrderItem,
  type ActorContext
} from "./order.service.js";
import { emitToRole } from "./socket.service.js";

const ticketTransitions: Readonly<Record<KitchenTicketStatus, readonly KitchenTicketStatus[]>> = {
  NEW: ["ACCEPTED", "PREPARING", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: []
};

export async function updateKitchenTicketStatus(actor: ActorContext, ticketId: string, status: KitchenTicketStatus) {
  if (actor.role !== "KITCHEN") throw forbidden();
  if (status === "CANCELLED") {
    throw forbidden("AUTH_MISSING_PERMISSION", "Kitchen tickets are cancelled through the cashier order workflow");
  }
  const ticket = await KitchenTicketModel.findOne({ _id: ticketId, restaurantId: actor.restaurantId });
  if (!ticket) throw notFound("KITCHEN_TICKET_NOT_FOUND", "Kitchen ticket was not found");
  if (!ticketTransitions[ticket.status].includes(status)) {
    throw conflict("KITCHEN_INVALID_TRANSITION", `Cannot transition ticket from ${ticket.status} to ${status}`);
  }
  const order = await OrderModel.findOne({ _id: ticket.orderId, restaurantId: actor.restaurantId });
  if (!order) throw notFound("ORDER_NOT_FOUND", "Order was not found");
  assertOrderAccess(order, actor);

  let workingOrder = order;
  const ensureAccepted = async () => {
    if (workingOrder.status === "PLACED") {
      workingOrder.status = "CONFIRMED";
      workingOrder.timeline.push({
        type: "ORDER_AUTO_CONFIRMED",
        previousStatus: "PLACED",
        newStatus: "CONFIRMED",
        timestamp: new Date(),
        source: "SYSTEM"
      });
      await workingOrder.save();
    }
    if (workingOrder.status === "CONFIRMED") {
      workingOrder = await transitionOrder(workingOrder, actor, { status: "ACCEPTED_BY_KITCHEN" });
    }
    if (!["ACCEPTED_BY_KITCHEN", "PREPARING", "PARTIALLY_READY", "READY"].includes(workingOrder.status)) {
      throw conflict("ORDER_INVALID_TRANSITION", "This order cannot be accepted by the kitchen");
    }
  };

  if (status === "ACCEPTED") {
    await ensureAccepted();
    ticket.acceptedAt ??= new Date();
  }

  if (status === "PREPARING") {
    await ensureAccepted();
    ticket.acceptedAt ??= new Date();
    for (const lineId of ticket.lineIds) {
      const item = workingOrder.items.find((entry) => entry.lineId === lineId);
      if (item && (item.status === "PENDING" || item.status === "QUEUED")) {
        workingOrder = await transitionOrderItem(workingOrder, actor, { lineId, status: "PREPARING" });
      }
    }
  }

  if (status === "READY") {
    for (const lineId of ticket.lineIds) {
      const item = workingOrder.items.find((entry) => entry.lineId === lineId);
      if (item?.status === "PREPARING") {
        workingOrder = await transitionOrderItem(workingOrder, actor, { lineId, status: "READY" });
      } else if (item && item.status !== "READY" && item.status !== "SERVED") {
        throw conflict("ORDER_INVALID_ITEM_TRANSITION", "All ticket items must be preparing before marking them ready");
      }
    }
    ticket.readyAt = new Date();
  }

  if (status === "COMPLETED") {
    const served = ticket.lineIds.every((lineId) => {
      const item = workingOrder.items.find((entry) => entry.lineId === lineId);
      return item?.status === "SERVED";
    });
    if (!served) throw conflict("ORDER_INVALID_ITEM_TRANSITION", "Only served ticket items can be completed");
  }

  ticket.status = status;
  await ticket.save();
  emitToRole(actor.restaurantId, "KITCHEN", "ticket:updated", serializeTicket(ticket));
  return { ticket, order: workingOrder };
}

export async function kitchenTicketViews(actor: ActorContext, station?: string, status?: KitchenTicketStatus) {
  if (actor.role !== "KITCHEN") throw forbidden();
  const tickets = await KitchenTicketModel.find({
    restaurantId: actor.restaurantId,
    ...(station ? { station: station.toUpperCase() } : {}),
    ...(status ? { status } : { status: { $in: ["NEW", "ACCEPTED", "PREPARING", "READY"] } })
  }).sort({ priority: -1, createdAt: 1 });
  const orderIds = tickets.map((ticket) => ticket.orderId);
  const orders = await OrderModel.find({ _id: { $in: orderIds }, restaurantId: actor.restaurantId });
  const byId = new Map(orders.map((order) => [order._id.toString(), order]));

  return tickets.map((ticket) => {
    const order = byId.get(ticket.orderId.toString());
    return {
      ...serializeTicket(ticket),
      order: order
        ? {
            id: order._id.toString(),
            orderNumber: order.orderNumber,
            mode: order.mode,
            status: order.status,
            guestName: order.guestName,
            items: serializeKitchenOrder(order).items.filter((item) => ticket.lineIds.includes(item.lineId))
          }
        : undefined
    };
  });
}

export async function setTicketPriority(actor: ActorContext, ticketId: string, priority: "NORMAL" | "PRIORITY" | "RUSH" | "REFIRE", reason: string) {
  if (actor.role !== "CASHIER" || !actor.permissions.includes("canOverridePrice")) {
    throw forbidden("AUTH_MISSING_PERMISSION", "Setting kitchen priority requires supervisor permission");
  }
  const ticket = await KitchenTicketModel.findOne({ _id: ticketId, restaurantId: actor.restaurantId });
  if (!ticket) throw notFound("KITCHEN_TICKET_NOT_FOUND", "Kitchen ticket was not found");
  ticket.priority = priority;
  await ticket.save();
  emitToRole(actor.restaurantId, "KITCHEN", "ticket:updated", serializeTicket(ticket));
  return ticket;
}
