import { conflict } from "../lib/errors.js";

export function assertTableCapacity(guestCount: number, capacity: number): void {
  if (guestCount > capacity) {
    throw conflict("TABLE_CAPACITY_EXCEEDED", `This table seats up to ${capacity} guests`);
  }
}