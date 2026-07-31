import { Router } from "express";

import { asyncHandler } from "../lib/asyncHandler.js";
import { notFound } from "../lib/errors.js";
import { validatedParam, validatedQuery } from "../lib/requestInput.js";
import { sendSuccess } from "../lib/response.js";
import { authContext, requireAuth } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { NotificationModel } from "../models/Notification.js";
import { notificationListRequestSchema, notificationReadRequestSchema } from "./schemas.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get("/", validateRequest(notificationListRequestSchema), asyncHandler(async (request, response) => {
  const actor = authContext(request);
  const query = validatedQuery<{ page: number; limit: number }>(request);
  const visibility = { $or: [{ accountId: actor.accountId }, { role: actor.role }] };
  const filter = { restaurantId: actor.restaurantId, ...visibility };
  const [notifications, total] = await Promise.all([
    NotificationModel.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
    NotificationModel.countDocuments(filter)
  ]);
  sendSuccess(response, notifications.map((notification) => ({
    id: notification._id.toString(),
    type: notification.type,
    title: notification.title,
    message: notification.message,
    entityType: notification.entityType,
    entityId: notification.entityId?.toString(),
    readAt: notification.readAt,
    createdAt: notification.createdAt
  })), 200, { page: query.page, limit: query.limit, total });
}));

notificationsRouter.patch("/:id/read", validateRequest(notificationReadRequestSchema), asyncHandler(async (request, response) => {
  const actor = authContext(request);
  const notification = await NotificationModel.findOneAndUpdate(
    {
      _id: validatedParam(request, "id"),
      restaurantId: actor.restaurantId,
      $or: [{ accountId: actor.accountId }, { role: actor.role }]
    },
    { $set: { readAt: new Date() } },
    { new: true }
  );
  if (!notification) throw notFound("NOTIFICATION_NOT_FOUND", "Notification was not found");
  sendSuccess(response, { id: notification._id.toString(), readAt: notification.readAt });
}));
