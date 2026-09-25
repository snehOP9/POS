import { Types } from "mongoose";

import { conflict, forbidden, notFound } from "../lib/errors.js";
import { serializeTable } from "../lib/serializers.js";
import { DiningTableModel } from "../models/DiningTable.js";
import { OrderModel } from "../models/Order.js";
import { TableSessionModel } from "../models/TableSession.js";
import { recordAudit } from "./audit.service.js";
import type { ActorContext } from "./order.service.js";
import { emitToRole } from "./socket.service.js";

function assertTableRole(actor: ActorContext): void {
  if (actor.role !== "WAITER" && actor.role !== "CASHIER") throw forbidden();
}

export async function listTables(actor: ActorContext, assignedOnly = false) {
  assertTableRole(actor);
  const filter = {
    restaurantId: actor.restaurantId,
    ...(assignedOnly && actor.role === "WAITER" ? { assignedWaiterId: actor.accountId } : {})
  };
  const tables = await DiningTableModel.find(filter).sort({ number: 1 });
  const sessions = await TableSessionModel.find({
    restaurantId: actor.restaurantId,
    tableId: { $in: tables.map((table) => table._id) },
    status: "OPEN"
  });
  const sessionsByTable = new Map(sessions.map((session) => [session.tableId.toString(), session]));
  return tables.map((table) => ({
    ...serializeTable(table),
    session: sessionsByTable.get(table._id.toString())
      ? {
          id: sessionsByTable.get(table._id.toString())?._id.toString(),
          guestCount: sessionsByTable.get(table._id.toString())?.guestCount,
          openedAt: sessionsByTable.get(table._id.toString())?.openedAt
        }
      : undefined
  }));
}

export async function openTableSession(actor: ActorContext, tableId: string, guestCount: number, note?: string) {
  assertTableRole(actor);
  const table = await DiningTableModel.findOne({ _id: tableId, restaurantId: actor.restaurantId });
  if (!table) throw notFound("TABLE_NOT_FOUND", "Dining table was not found");
  if (table.status === "DISABLED") throw conflict("TABLE_UNAVAILABLE", "This table is disabled");
  if (guestCount > table.capacity) throw conflict("TABLE_CAPACITY_EXCEEDED", `This table seats up to ${table.capacity} guests`);
  if (actor.role === "WAITER" && table.assignedWaiterId && table.assignedWaiterId.toString() !== actor.accountId) {
    throw forbidden("TABLE_NOT_ASSIGNED", "This table is not assigned to you");
  }
  const active = await TableSessionModel.findOne({ restaurantId: actor.restaurantId, tableId: table._id, status: "OPEN" });
  if (active) throw conflict("TABLE_ALREADY_ACTIVE", "This table already has an active session");

  const session = await TableSessionModel.create({
    restaurantId: new Types.ObjectId(actor.restaurantId),
    tableId: table._id,
    openedByAccountId: new Types.ObjectId(actor.accountId),
    guestCount,
    status: "OPEN",
    ...(note ? { notes: note } : {})
  });
  table.status = "OCCUPIED";
  await table.save();
  emitToRole(actor.restaurantId, "WAITER", "table:updated", serializeTable(table));
  emitToRole(actor.restaurantId, "CASHIER", "table:updated", serializeTable(table));
  await recordAudit({
    restaurantId: actor.restaurantId,
    actorId: actor.accountId,
    actorRole: actor.role,
    action: "TABLE_SESSION_OPENED",
    entityType: "TableSession",
    entityId: session._id.toString(),
    after: { tableId, guestCount }
  });
  return { table, session };
}

export async function updateTableSession(actor: ActorContext, tableId: string, guestCount: number, note?: string) {
  assertTableRole(actor);
  const table = await DiningTableModel.findOne({ _id: tableId, restaurantId: actor.restaurantId });
  if (!table) throw notFound("TABLE_NOT_FOUND", "Dining table was not found");
  if (table.status === "DISABLED") throw conflict("TABLE_UNAVAILABLE", "This table is disabled");
  if (guestCount > table.capacity) throw conflict("TABLE_CAPACITY_EXCEEDED", `This table seats up to ${table.capacity} guests`);
  if (actor.role === "WAITER" && table.assignedWaiterId && table.assignedWaiterId.toString() !== actor.accountId) throw forbidden("TABLE_NOT_ASSIGNED", "This table is not assigned to you");
  const session = await TableSessionModel.findOne({ restaurantId: actor.restaurantId, tableId: table._id, status: "OPEN" });
  if (!session) throw conflict("TABLE_SESSION_NOT_OPEN", "This table does not have an active session");
  session.guestCount = guestCount;
  if (note !== undefined) session.notes = note;
  await session.save();
  await recordAudit({ restaurantId: actor.restaurantId, actorId: actor.accountId, actorRole: actor.role, action: "TABLE_SESSION_UPDATED", entityType: "TableSession", entityId: session._id.toString(), after: { tableId, guestCount, note } });
  emitToRole(actor.restaurantId, "WAITER", "table:updated", serializeTable(table));
  emitToRole(actor.restaurantId, "CASHIER", "table:updated", serializeTable(table));
  return { table, session };
}

export async function closeTableSession(actor: ActorContext, tableId: string) {
  assertTableRole(actor);
  const table = await DiningTableModel.findOne({ _id: tableId, restaurantId: actor.restaurantId });
  if (!table) throw notFound("TABLE_NOT_FOUND", "Dining table was not found");
  const session = await TableSessionModel.findOne({ restaurantId: actor.restaurantId, tableId: table._id, status: "OPEN" });
  if (!session) throw conflict("TABLE_SESSION_NOT_OPEN", "This table does not have an active session");
  const unsettled = await OrderModel.exists({
    restaurantId: actor.restaurantId,
    tableSessionId: session._id,
    $or: [
      { status: { $nin: ["COMPLETED", "CANCELLED", "REJECTED"] } },
      {
        status: { $nin: ["CANCELLED", "REJECTED"] },
        paymentStatus: { $nin: ["PAID", "REFUNDED"] }
      }
    ]
  });
  if (unsettled) throw conflict("TABLE_HAS_UNSETTLED_ORDER", "Complete and settle, or cancel, all table orders before closing the session");
  session.status = "CLOSED";
  session.closedAt = new Date();
  await session.save();
  table.status = "AVAILABLE";
  await table.save();
  emitToRole(actor.restaurantId, "WAITER", "table:updated", serializeTable(table));
  emitToRole(actor.restaurantId, "CASHIER", "table:updated", serializeTable(table));
  return { table, session };
}

export async function resolveTableQrToken(token: string) {
  const table = await DiningTableModel.findOne({ qrToken: token, orderingEnabled: true }).select("+qrToken");
  if (!table || table.status === "DISABLED") throw notFound("TABLE_INVALID_TOKEN", "This table QR code is invalid or inactive");
  return serializeTable(table);
}
