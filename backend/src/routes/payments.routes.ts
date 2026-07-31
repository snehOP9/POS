import type { RequestHandler } from "express";
import { Router } from "express";

import { asyncHandler } from "../lib/asyncHandler.js";
import { validatedParam } from "../lib/requestInput.js";
import { sendSuccess } from "../lib/response.js";
import { serializeOrder, serializePayment } from "../lib/serializers.js";
import { authContext, requireAuth, requireRole } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  createRazorpayOrder,
  handleRazorpayWebhook,
  refundPayment,
  takeCashPayment,
  verifyRazorpayPayment
} from "../services/payment.service.js";
import {
  cashPaymentRequestSchema,
  paymentRefundRequestSchema,
  razorpayCreateRequestSchema,
  razorpayVerifyRequestSchema
} from "./schemas.js";

export const paymentsRouter = Router();

paymentsRouter.post("/cash", requireAuth, requireRole("CASHIER"), validateRequest(cashPaymentRequestSchema), asyncHandler(async (request, response) => {
  const body = request.body as { orderId: string; cashReceivedPaise: number };
  const result = await takeCashPayment(authContext(request), body.orderId, body.cashReceivedPaise);
  sendSuccess(response, {
    payment: serializePayment(result.payment),
    order: serializeOrder(result.order),
    duePaise: result.duePaise,
    due: result.duePaise / 100,
    changePaise: result.changePaise,
    change: result.changePaise / 100
  }, 201);
}));

paymentsRouter.post("/razorpay/order", requireAuth, requireRole("CUSTOMER", "CASHIER"), validateRequest(razorpayCreateRequestSchema), asyncHandler(async (request, response) => {
  const body = request.body as { orderId: string };
  const result = await createRazorpayOrder(authContext(request), body.orderId);
  sendSuccess(response, {
    payment: serializePayment(result.payment),
    razorpayOrder: result.razorpayOrder,
    keyId: result.keyId
  }, 201);
}));

paymentsRouter.post("/razorpay/verify", requireAuth, requireRole("CUSTOMER", "CASHIER"), validateRequest(razorpayVerifyRequestSchema), asyncHandler(async (request, response) => {
  const result = await verifyRazorpayPayment(authContext(request), request.body as Parameters<typeof verifyRazorpayPayment>[1]);
  sendSuccess(response, {
    payment: serializePayment(result.payment),
    ...(result.order ? { order: serializeOrder(result.order) } : {}),
    alreadyVerified: result.alreadyVerified
  });
}));

paymentsRouter.post("/:id/refund", requireAuth, requireRole("CASHIER"), validateRequest(paymentRefundRequestSchema), asyncHandler(async (request, response) => {
  const body = request.body as { refundAmountPaise?: number };
  const result = await refundPayment(authContext(request), validatedParam(request, "id"), body.refundAmountPaise);
  sendSuccess(response, { payment: serializePayment(result.payment), order: serializeOrder(result.order) });
}));

export const razorpayWebhookHandler: RequestHandler = asyncHandler(async (request, response) => {
  if (!Buffer.isBuffer(request.body)) {
    throw new Error("Razorpay webhook requires a raw JSON body");
  }
  await handleRazorpayWebhook(request.body, request.header("x-razorpay-signature"));
  response.status(200).json({ success: true });
});
