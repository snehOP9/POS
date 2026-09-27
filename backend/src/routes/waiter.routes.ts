import { Router } from "express";

import { asyncHandler } from "../lib/asyncHandler.js";
import { validatedParam } from "../lib/requestInput.js";
import { sendSuccess } from "../lib/response.js";
import { serializeOrder } from "../lib/serializers.js";
import { authContext, requireAuth, requireRole } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { createNotification } from "../services/notification.service.js";
import { createOrder, findOrderForActor } from "../services/order.service.js";
import { listTables, openTableSession, updateTableSession } from "../services/table.service.js";
import { orderParamsSchema, tableOpenRequestSchema, tableSessionUpdateRequestSchema, waiterTableOrderRequestSchema } from "./schemas.js";

export const waiterRouter = Router();

waiterRouter.use(requireAuth, requireRole("WAITER"));

waiterRouter.get("/tables", asyncHandler(async (request, response) => {
  sendSuccess(response, await listTables(authContext(request), true));
}));

waiterRouter.post("/tables/:id/open", validateRequest(tableOpenRequestSchema), asyncHandler(async (request, response) => {
  const body = request.body as { guestCount: number; note?: string };
  const result = await openTableSession(authContext(request), validatedParam(request, "id"), body.guestCount, body.note);
  sendSuccess(response, {
    table: { id: result.table._id.toString(), status: result.table.status },
    session: { id: result.session._id.toString(), status: result.session.status, guestCount: result.session.guestCount }
  }, 201);
}));

waiterRouter.patch("/tables/:id/session", validateRequest(tableSessionUpdateRequestSchema), asyncHandler(async (request, response) => {
  const body = request.body as { guestCount: number; note?: string };
  const result = await updateTableSession(authContext(request), validatedParam(request, "id"), body.guestCount, body.note);
  sendSuccess(response, { table: { id: result.table._id.toString(), status: result.table.status }, session: { id: result.session._id.toString(), status: result.session.status, guestCount: result.session.guestCount, notes: result.session.notes } });
}));

waiterRouter.post("/tables/:id/orders", validateRequest(waiterTableOrderRequestSchema), asyncHandler(async (request, response) => {
  const body = request.body as Parameters<typeof createOrder>[1];
  const order = await createOrder(authContext(request), { ...body, tableId: validatedParam(request, "id"), tableToken: undefined });
  sendSuccess(response, serializeOrder(order), 201);
}));

waiterRouter.post("/orders/:id/bill-request", validateRequest(orderParamsSchema), asyncHandler(async (request, response) => {
  const actor = authContext(request);
  const order = await findOrderForActor(validatedParam(request, "id"), actor);
  await createNotification({
    restaurantId: actor.restaurantId,
    role: "CASHIER",
    type: "BILL_REQUESTED",
    title: "Bill requested",
    message: `Bill requested for ${order.orderNumber}`,
    entityType: "Order",
    entityId: order._id.toString()
  });
  sendSuccess(response, { order: serializeOrder(order), billRequested: true });
}));
