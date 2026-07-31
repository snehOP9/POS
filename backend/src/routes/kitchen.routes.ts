import { Router } from "express";

import { asyncHandler } from "../lib/asyncHandler.js";
import { notFound } from "../lib/errors.js";
import { validatedParam, validatedQuery } from "../lib/requestInput.js";
import { sendSuccess } from "../lib/response.js";
import { serializeKitchenOrder, serializeTicket } from "../lib/serializers.js";
import { authContext, requireAuth } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { KitchenTicketModel } from "../models/KitchenTicket.js";
import { findOrderForActor, transitionOrderItem } from "../services/order.service.js";
import { kitchenTicketViews, setTicketPriority, updateKitchenTicketStatus } from "../services/kitchen.service.js";
import {
  kitchenPriorityRequestSchema,
  kitchenQuerySchema,
  kitchenTicketItemStatusRequestSchema,
  kitchenTicketStatusRequestSchema
} from "./schemas.js";

export const kitchenRouter = Router();

kitchenRouter.use(requireAuth);

kitchenRouter.get("/tickets", validateRequest(kitchenQuerySchema), asyncHandler(async (request, response) => {
  const query = validatedQuery<{ station?: string; status?: Parameters<typeof kitchenTicketViews>[2] }>(request);
  sendSuccess(response, await kitchenTicketViews(authContext(request), query.station, query.status));
}));

kitchenRouter.patch("/tickets/:id/status", validateRequest(kitchenTicketStatusRequestSchema), asyncHandler(async (request, response) => {
  const body = request.body as { status: Parameters<typeof updateKitchenTicketStatus>[2] };
  const result = await updateKitchenTicketStatus(authContext(request), validatedParam(request, "id"), body.status);
  sendSuccess(response, { ticket: serializeTicket(result.ticket), order: serializeKitchenOrder(result.order) });
}));

kitchenRouter.patch("/tickets/:id/items/:lineId/status", validateRequest(kitchenTicketItemStatusRequestSchema), asyncHandler(async (request, response) => {
  const actor = authContext(request);
  const ticket = await KitchenTicketModel.findOne({ _id: validatedParam(request, "id"), restaurantId: actor.restaurantId });
  if (!ticket) throw notFound("KITCHEN_TICKET_NOT_FOUND", "Kitchen ticket was not found");
  const lineId = validatedParam(request, "lineId");
  if (!ticket.lineIds.includes(lineId)) throw notFound("ORDER_ITEM_NOT_FOUND", "Order item is not part of this ticket");
  const order = await findOrderForActor(ticket.orderId.toString(), actor);
  const body = request.body as { status: Parameters<typeof transitionOrderItem>[2]["status"]; note?: string; expectedVersion?: number };
  const updated = await transitionOrderItem(order, actor, { ...body, lineId });
  const updatedTicket = await KitchenTicketModel.findById(ticket._id);
  sendSuccess(response, { ticket: serializeTicket(updatedTicket ?? ticket), order: serializeKitchenOrder(updated) });
}));

kitchenRouter.patch("/tickets/:id/priority", validateRequest(kitchenPriorityRequestSchema), asyncHandler(async (request, response) => {
  const body = request.body as { priority: "NORMAL" | "PRIORITY" | "RUSH" | "REFIRE"; reason: string };
  const ticket = await setTicketPriority(authContext(request), validatedParam(request, "id"), body.priority, body.reason);
  sendSuccess(response, serializeTicket(ticket));
}));
