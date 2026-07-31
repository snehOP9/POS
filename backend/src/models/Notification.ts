import { Schema, model, type Types } from "mongoose";

import { ROLES, type Role } from "../domain/access.js";

export interface Notification {
  restaurantId: Types.ObjectId;
  accountId?: Types.ObjectId;
  role?: Role;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: Types.ObjectId;
  readAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const notificationSchema = new Schema<Notification>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "RestaurantConfig", required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: "Account", index: true },
    role: { type: String, enum: ROLES, index: true },
    type: { type: String, required: true, maxlength: 80 },
    title: { type: String, required: true, maxlength: 160 },
    message: { type: String, required: true, maxlength: 500 },
    entityType: { type: String, maxlength: 80 },
    entityId: { type: Schema.Types.ObjectId },
    readAt: { type: Date }
  },
  { timestamps: true, versionKey: "version" }
);

notificationSchema.index({ restaurantId: 1, accountId: 1, readAt: 1, createdAt: -1 });

export const NotificationModel = model<Notification>("Notification", notificationSchema);
