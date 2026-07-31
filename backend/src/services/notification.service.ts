import { Types } from "mongoose";

import type { Role } from "../domain/access.js";
import { NotificationModel } from "../models/Notification.js";
import { emitToAccount, emitToRole } from "./socket.service.js";

export interface NotificationInput {
  restaurantId: string;
  accountId?: string;
  role?: Role;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

export async function createNotification(input: NotificationInput) {
  const notification = await NotificationModel.create({
    ...input,
    restaurantId: new Types.ObjectId(input.restaurantId),
    ...(input.accountId ? { accountId: new Types.ObjectId(input.accountId) } : {}),
    ...(input.entityId ? { entityId: new Types.ObjectId(input.entityId) } : {})
  });
  const payload = notification.toJSON();
  if (input.accountId) emitToAccount(input.restaurantId, input.accountId, "notification:created", payload);
  if (input.role) emitToRole(input.restaurantId, input.role, "notification:created", payload);
  return notification;
}
