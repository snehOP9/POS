import { Router } from "express";

import { asyncHandler } from "../lib/asyncHandler.js";
import { sendSuccess } from "../lib/response.js";
import { authContext, requireAuth, requireRole } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { closeShift, getCurrentShift, openShift, serializeShift } from "../services/shift.service.js";
import { shiftCloseRequestSchema, shiftOpenRequestSchema } from "./schemas.js";

export const shiftsRouter = Router();

shiftsRouter.use(requireAuth, requireRole("CASHIER"));

shiftsRouter.get("/current", asyncHandler(async (request, response) => {
  const shift = await getCurrentShift(authContext(request));
  sendSuccess(response, { shift: shift ? serializeShift(shift) : null });
}));

shiftsRouter.post("/open", validateRequest(shiftOpenRequestSchema), asyncHandler(async (request, response) => {
  const shift = await openShift(authContext(request), request.body as Parameters<typeof openShift>[1]);
  sendSuccess(response, serializeShift(shift), 201);
}));

shiftsRouter.post("/close", validateRequest(shiftCloseRequestSchema), asyncHandler(async (request, response) => {
  const shift = await closeShift(authContext(request), request.body as Parameters<typeof closeShift>[1]);
  sendSuccess(response, serializeShift(shift));
}));
