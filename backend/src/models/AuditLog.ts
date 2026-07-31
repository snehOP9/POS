import { Schema, model, type Types } from "mongoose";

import { ROLES, type Role } from "../domain/access.js";

export interface AuditLog {
  restaurantId: Types.ObjectId;
  actorId?: Types.ObjectId;
  actorRole?: Role;
  action: string;
  entityType: string;
  entityId?: Types.ObjectId;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ip?: string;
  requestId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const auditLogSchema = new Schema<AuditLog>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "RestaurantConfig", required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "Account", index: true },
    actorRole: { type: String, enum: ROLES },
    action: { type: String, required: true, maxlength: 120 },
    entityType: { type: String, required: true, maxlength: 80 },
    entityId: { type: Schema.Types.ObjectId, index: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
    ip: { type: String, maxlength: 64 },
    requestId: { type: String, maxlength: 100 }
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

auditLogSchema.index({ restaurantId: 1, entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ restaurantId: 1, actorId: 1, createdAt: -1 });

export const AuditLogModel = model<AuditLog>("AuditLog", auditLogSchema);
