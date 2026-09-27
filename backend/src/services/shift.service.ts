import { conflict, forbidden } from "../lib/errors.js";
import { serializeShift } from "../lib/serializers.js";
import { ShiftModel } from "../models/Shift.js";
import { recordAudit } from "./audit.service.js";
import type { ActorContext } from "./order.service.js";

export function assertShiftPermission(actor: ActorContext, permission: "canOpenShift" | "canCloseShift"): void {
  if (actor.role !== "CASHIER" || !actor.permissions.includes(permission)) {
    throw forbidden("AUTH_MISSING_PERMISSION", "Your account lacks the required shift permission");
  }
}

export async function getCurrentShift(actor: ActorContext) {
  if (actor.role !== "CASHIER") throw forbidden();
  return ShiftModel.findOne({ restaurantId: actor.restaurantId, cashierId: actor.accountId, status: "OPEN" });
}

export async function openShift(actor: ActorContext, input: { openingCashPaise: number; registerName: string; note?: string }) {
  assertShiftPermission(actor, "canOpenShift");
  const existing = await getCurrentShift(actor);
  if (existing) throw conflict("SHIFT_ALREADY_OPEN", "You already have an open shift");
  const shift = await ShiftModel.create({
    restaurantId: actor.restaurantId,
    cashierId: actor.accountId,
    registerName: input.registerName,
    openingCashPaise: input.openingCashPaise,
    cashSalesPaise: 0,
    status: "OPEN",
    ...(input.note ? { note: input.note } : {})
  });
  await recordAudit({
    restaurantId: actor.restaurantId,
    actorId: actor.accountId,
    actorRole: actor.role,
    action: "SHIFT_OPENED",
    entityType: "Shift",
    entityId: shift._id.toString(),
    after: { openingCashPaise: shift.openingCashPaise, registerName: shift.registerName }
  });
  return shift;
}

export async function closeShift(actor: ActorContext, input: { closingCashPaise: number; note?: string }) {
  assertShiftPermission(actor, "canCloseShift");
  const shift = await getCurrentShift(actor);
  if (!shift) throw conflict("SHIFT_NOT_OPEN", "There is no open shift to close");
  shift.expectedCashPaise = shift.openingCashPaise + shift.cashSalesPaise;
  shift.closingCashPaise = input.closingCashPaise;
  shift.closedAt = new Date();
  shift.status = "CLOSED";
  if (input.note) shift.note = input.note;
  await shift.save();
  await recordAudit({
    restaurantId: actor.restaurantId,
    actorId: actor.accountId,
    actorRole: actor.role,
    action: "SHIFT_CLOSED",
    entityType: "Shift",
    entityId: shift._id.toString(),
    after: {
      expectedCashPaise: shift.expectedCashPaise,
      closingCashPaise: shift.closingCashPaise,
      variancePaise: shift.closingCashPaise - shift.expectedCashPaise
    }
  });
  return shift;
}

export { serializeShift };
