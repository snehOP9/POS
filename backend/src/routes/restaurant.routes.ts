import { Router } from "express";

import { asyncHandler } from "../lib/asyncHandler.js";
import { notFound } from "../lib/errors.js";
import { sendSuccess } from "../lib/response.js";
import { authContext, requireAuth, requirePermission, requireRole } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { RestaurantConfigModel } from "../models/RestaurantConfig.js";
import { recordAudit } from "../services/audit.service.js";
import { ownerRestaurant } from "../services/restaurant.service.js";
import { restaurantProfileRequestSchema } from "./schemas.js";

export const restaurantRouter = Router();

restaurantRouter.get("/profile", requireAuth, requireRole("CASHIER"), requirePermission("canEditRestaurantSettings"), asyncHandler(async (request, response) => {
  const actor = authContext(request);
  const restaurant = await RestaurantConfigModel.findById(actor.restaurantId);
  if (!restaurant) throw notFound("RESTAURANT_NOT_CONFIGURED", "Restaurant configuration was not found");
  sendSuccess(response, ownerRestaurant(restaurant));
}));

restaurantRouter.patch("/profile", requireAuth, requireRole("CASHIER"), requirePermission("canEditRestaurantSettings"), validateRequest(restaurantProfileRequestSchema), asyncHandler(async (request, response) => {
  const actor = authContext(request);
  const body = request.body as Record<string, unknown>;
  const before = await RestaurantConfigModel.findById(actor.restaurantId);
  const restaurant = await RestaurantConfigModel.findByIdAndUpdate(actor.restaurantId, { $set: body }, { new: true, runValidators: true });
  if (!restaurant) throw notFound("RESTAURANT_NOT_CONFIGURED", "Restaurant configuration was not found");

  await recordAudit({
    restaurantId: actor.restaurantId,
    actorId: actor.accountId,
    actorRole: actor.role,
    action: "restaurant.profile.updated",
    entityType: "RestaurantConfig",
    entityId: restaurant._id.toString(),
    before: before ? { name: before.name, publicProfile: before.publicProfile } : undefined,
    after: { name: restaurant.name, publicProfile: restaurant.publicProfile },
    requestId: request.requestId
  });
  sendSuccess(response, ownerRestaurant(restaurant));
}));
