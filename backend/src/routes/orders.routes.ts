import { Router } from "express";
import rateLimit from "express-rate-limit";

import { asyncHandler } from "../lib/asyncHandler.js";
import { forbidden } from "../lib/errors.js";
import { validatedParam, validatedQuery } from "../lib/requestInput.js";
import { sendSuccess } from "../lib/response.js";
import { serializeOrder } from "../lib/serializers.js";
import { authContext, requireAuth, requireRole } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { OrderModel } from "../models/Order.js";
import { createOrder, findOrderForActor, transitionOrder, transitionOrderItem } from "../services/order.service.js";
import { createGuestOrder, findGuestOrder } from "../services/guest-order.service.js";
import { priceOrder } from "../services/pricing.service.js";
import { getSingleRestaurant } from "../services/restaurant.service.js";
import {
  createOrderRequestSchema,
  guestOrderParamsSchema,
  orderItemStatusRequestSchema,
  orderListRequestSchema,
  orderParamsSchema,
  orderQuoteRequestSchema,
  orderStatusRequestSchema
} from "./schemas.js";

export const ordersRouter = Router();

const guestOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_request, response) => response.status(429).json({ success: false, error: { code: "GUEST_ORDER_RATE_LIMITED", message: "Too many order attempts. Please wait a few minutes and try again." } })
});

ordersRouter.post("/quote", validateRequest(orderQuoteRequestSchema), asyncHandler(async (request, response) => {
  const restaurant = await getSingleRestaurant();
  const body = request.body as { items: Parameters<typeof priceOrder>[1] };
  const quote = await priceOrder(restaurant, body.items);
  sendSuccess(response, {
    items: quote.items.map((item) => ({
      ...item,
      menuItemId: item.menuItemId.toString(),
      unitPrice: item.unitPricePaise / 100,
      lineSubtotal: item.lineSubtotalPaise / 100
    })),
    pricing: { ...quote.pricing, total: quote.pricing.grandTotalPaise / 100 },
    total: quote.pricing.grandTotalPaise / 100,
    totalPaise: quote.pricing.grandTotalPaise
  });
}));

ordersRouter.post("/", requireAuth, requireRole("CUSTOMER", "WAITER", "CASHIER"), validateRequest(createOrderRequestSchema), asyncHandler(async (request, response) => {
  const order = await createOrder(authContext(request), request.body as Parameters<typeof createOrder>[1]);
  sendSuccess(response, serializeOrder(order), 201);
}));

ordersRouter.post("/guest", guestOrderLimiter, validateRequest(createOrderRequestSchema), asyncHandler(async (request, response) => {
  const { order, trackingToken } = await createGuestOrder(request.body as Parameters<typeof createGuestOrder>[0]);
  sendSuccess(response, { ...serializeOrder(order), trackingToken }, 201);
}));

ordersRouter.get("/guest/:id", validateRequest(guestOrderParamsSchema), asyncHandler(async (request, response) => {
  const order = await findGuestOrder(validatedParam(request, "id"), validatedQuery<{ token: string }>(request).token);
  sendSuccess(response, serializeOrder(order));
}));

ordersRouter.get("/", requireAuth, validateRequest(orderListRequestSchema), asyncHandler(async (request, response) => {
  const actor = authContext(request);
  if (actor.role === "KITCHEN") throw forbidden("AUTH_FORBIDDEN", "Use the kitchen ticket feed instead");
  const query = validatedQuery<{ page: number; limit: number; status?: string }>(request);
  const filter = {
    restaurantId: actor.restaurantId,
    ...(actor.role === "CUSTOMER" ? { customerId: actor.accountId } : {}),
    ...(query.status ? { status: query.status } : {})
  };
  const [orders, total] = await Promise.all([
    OrderModel.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
    OrderModel.countDocuments(filter)
  ]);
  sendSuccess(response, orders.map(serializeOrder), 200, { page: query.page, limit: query.limit, total });
}));

ordersRouter.get("/:id", requireAuth, validateRequest(orderParamsSchema), asyncHandler(async (request, response) => {
  const actor = authContext(request);
  if (actor.role === "KITCHEN") throw forbidden("AUTH_FORBIDDEN", "Use the kitchen ticket feed instead");
  const order = await findOrderForActor(validatedParam(request, "id"), actor);
  sendSuccess(response, serializeOrder(order));
}));

ordersRouter.patch("/:id/status", requireAuth, validateRequest(orderStatusRequestSchema), asyncHandler(async (request, response) => {
  const body = request.body as { status: Parameters<typeof transitionOrder>[2]["status"]; note?: string; expectedVersion?: number };
  const actor = authContext(request);
  if (actor.role === "KITCHEN") throw forbidden("AUTH_FORBIDDEN", "Kitchen status updates must use ticket workflows");
  const order = await findOrderForActor(validatedParam(request, "id"), actor);
  const updated = await transitionOrder(order, actor, body);
  sendSuccess(response, serializeOrder(updated));
}));

ordersRouter.patch("/:id/items/:lineId/status", requireAuth, validateRequest(orderItemStatusRequestSchema), asyncHandler(async (request, response) => {
  const body = request.body as { status: Parameters<typeof transitionOrderItem>[2]["status"]; note?: string; expectedVersion?: number };
  const actor = authContext(request);
  if (actor.role === "KITCHEN") throw forbidden("AUTH_FORBIDDEN", "Kitchen item updates must use ticket workflows");
  const order = await findOrderForActor(validatedParam(request, "id"), actor);
  const updated = await transitionOrderItem(order, actor, { ...body, lineId: validatedParam(request, "lineId") });
  sendSuccess(response, serializeOrder(updated));
}));
