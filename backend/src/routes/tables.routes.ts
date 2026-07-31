import { Router } from "express";

import { asyncHandler } from "../lib/asyncHandler.js";
import { validatedParam } from "../lib/requestInput.js";
import { sendSuccess } from "../lib/response.js";
import { authContext, requireAuth, requireRole } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { closeTableSession, listTables, openTableSession, resolveTableQrToken } from "../services/table.service.js";
import { tableOpenRequestSchema, tableParamsSchema, tableTokenParamsSchema } from "./schemas.js";

export const tablesRouter = Router();

tablesRouter.get("/resolve/:token", validateRequest(tableTokenParamsSchema), asyncHandler(async (request, response) => {
  sendSuccess(response, await resolveTableQrToken(validatedParam(request, "token")));
}));

tablesRouter.get("/", requireAuth, requireRole("WAITER", "CASHIER"), asyncHandler(async (request, response) => {
  const actor = authContext(request);
  sendSuccess(response, await listTables(actor, actor.role === "WAITER"));
}));

tablesRouter.post("/:id/session", requireAuth, requireRole("WAITER", "CASHIER"), validateRequest(tableOpenRequestSchema), asyncHandler(async (request, response) => {
  const body = request.body as { guestCount: number; note?: string };
  const result = await openTableSession(authContext(request), validatedParam(request, "id"), body.guestCount, body.note);
  sendSuccess(response, {
    table: { id: result.table._id.toString(), status: result.table.status },
    session: { id: result.session._id.toString(), status: result.session.status, guestCount: result.session.guestCount }
  }, 201);
}));

tablesRouter.post("/:id/close", requireAuth, requireRole("WAITER", "CASHIER"), validateRequest(tableParamsSchema), asyncHandler(async (request, response) => {
  const result = await closeTableSession(authContext(request), validatedParam(request, "id"));
  sendSuccess(response, {
    table: { id: result.table._id.toString(), status: result.table.status },
    session: { id: result.session._id.toString(), status: result.session.status, closedAt: result.session.closedAt }
  });
}));
