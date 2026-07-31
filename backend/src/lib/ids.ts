import { randomBytes, randomUUID } from "node:crypto";

export function opaqueToken(): string {
  return randomBytes(24).toString("base64url");
}

export function lineId(): string {
  return randomUUID();
}

export function orderNumber(prefix: string): string {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `${prefix}-${day}-${randomBytes(3).toString("hex").toUpperCase()}`;
}
