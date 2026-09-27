import { badRequest, conflict } from "../lib/errors.js";

export function assertTableCapacity(guestCount: number, capacity: number): void {
  if (!Number.isInteger(guestCount) || guestCount < 1) {
    throw badRequest("TABLE_GUEST_COUNT_INVALID", "Guest count must be a whole number of at least one");
  }
  if (guestCount > capacity) {
    throw conflict("TABLE_CAPACITY_EXCEEDED", `This table seats up to ${capacity} guests`);
  }
}