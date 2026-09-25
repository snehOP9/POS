import { Router } from "express";

import { asyncHandler } from "../lib/asyncHandler.js";
import { validatedQuery } from "../lib/requestInput.js";
import { sendSuccess } from "../lib/response.js";
import { authContext, requireAuth, requireRole } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { reportSummary, serializeReportSummary } from "../services/report.service.js";
import { reportQuerySchema } from "./schemas.js";

export const reportsRouter = Router();

reportsRouter.get("/summary", requireAuth, requireRole("CASHIER"), validateRequest(reportQuerySchema), asyncHandler(async (request, response) => {
  const query = validatedQuery<{ from: Date; to: Date }>(request);
  const report = await reportSummary(authContext(request), query.from, query.to);
  sendSuccess(response, serializeReportSummary(report));
}));