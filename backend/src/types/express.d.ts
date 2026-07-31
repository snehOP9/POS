import type { Permission, Role } from "../domain/access.js";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        accountId: string;
        restaurantId: string;
        role: Role;
        permissions: Permission[];
        tokenVersion: number;
      };
      requestId?: string;
    }
  }
}

export {};
