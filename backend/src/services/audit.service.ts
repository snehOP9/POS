import { Types } from "mongoose";

import { logger } from "../config/logger.js";
import type { Role } from "../domain/access.js";
import { AuditLogModel } from "../models/AuditLog.js";

export interface AuditInput {
  restaurantId: string;
  actorId?: string;
  actorRole?: Role;
  action: string;
  entityType: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ip?: string;
  requestId?: string;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await AuditLogModel.create({
      ...input,
      restaurantId: new Types.ObjectId(input.restaurantId),
      ...(input.actorId ? { actorId: new Types.ObjectId(input.actorId) } : {}),
      ...(input.entityId ? { entityId: new Types.ObjectId(input.entityId) } : {})
    });
  } catch (error) {
    logger.error({ err: error, action: input.action }, "Failed to persist audit log");
  }
}
