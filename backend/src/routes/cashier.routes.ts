import { Router } from "express";

import { asyncHandler } from "../lib/asyncHandler.js";
import { validatedParam, validatedQuery } from "../lib/requestInput.js";
import { sendSuccess } from "../lib/response.js";
import { serializeOrder } from "../lib/serializers.js";
import { authContext, requireAuth, requireRole } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { applyOrderDiscount, cashierOrderList, orderReceipt } from "../services/cashier.service.js";
import { createOrder } from "../services/order.service.js";
import { createOrderRequestSchema, discountRequestSchema, orderListRequestSchema, orderParamsSchema } from "./schemas.js";

export const cashierRouter = Router();

cashierRouter.use(requireAuth, requireRole("CASHIER"));

cashierRouter.get("/orders", validateRequest(orderListRequestSchema), asyncHandler(async (request, response) => {
  const query = validatedQuery<{ page: number; limit: number; status?: string }>(request);
  const data = await cashierOrderList(authContext(request), query.status, query.page, query.limit);
  sendSuccess(response, data.orders, 200, { page: data.page, limit: data.limit, total: data.total });
}));

cashierRouter.post("/orders", validateRequest(createOrderRequestSchema), asyncHandler(async (request, response) => {
  const order = await createOrder(authContext(request), request.body as Parameters<typeof createOrder>[1]);
  sendSuccess(response, serializeOrder(order), 201);
}));

cashierRouter.patch("/orders/:id/discount", validateRequest(discountRequestSchema), asyncHandler(async (request, response) => {
  const body = request.body as { discountPaise: number; reason: string; expectedVersion?: number };
  const order = await applyOrderDiscount(authContext(request), validatedParam(request, "id"), body.discountPaise, body.reason, body.expectedVersion);
  sendSuccess(response, serializeOrder(order));
}));

cashierRouter.get("/orders/:id/receipt", validateRequest(orderParamsSchema), asyncHandler(async (request, response) => {
  sendSuccess(response, { receipt: await orderReceipt(authContext(request), validatedParam(request, "id")) });
}));
