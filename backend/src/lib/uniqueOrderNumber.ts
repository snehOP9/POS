import { orderNumber } from "./ids.js";
import { conflict } from "./errors.js";

type DuplicateKeyError = {
  code?: number;
  keyPattern?: Record<string, unknown>;
};

function isOrderNumberCollision(error: unknown): error is DuplicateKeyError {
  if (!error || typeof error !== "object") return false;
  const candidate = error as DuplicateKeyError;
  return candidate.code === 11000 && candidate.keyPattern?.orderNumber === 1;
}

export async function createWithUniqueOrderNumber<T>(
  prefix: string,
  persist: (number: string) => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await persist(orderNumber(prefix));
    } catch (error) {
      if (!isOrderNumberCollision(error)) throw error;
      if (attempt === maxAttempts - 1) {
        throw conflict("ORDER_NUMBER_COLLISION", "Unable to allocate a unique order number; retry the order");
      }
    }
  }
  throw conflict("ORDER_NUMBER_COLLISION", "Unable to allocate a unique order number; retry the order");
}
