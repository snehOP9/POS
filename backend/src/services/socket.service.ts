import type { Server as HttpServer } from "node:http";

import { Server } from "socket.io";

import { env } from "../config/env.js";
import type { Role } from "../domain/access.js";
import { AccountModel } from "../models/Account.js";
import { verifyToken } from "./auth.service.js";

let socketServer: Server | undefined;

export function initializeSocket(server: HttpServer): Server {
  socketServer = new Server(server, {
    cors: {
      origin: env.clientUrls,
      credentials: true
    }
  });

  socketServer.use(async (socket, next) => {
    try {
      const token = typeof socket.handshake.auth.token === "string" ? socket.handshake.auth.token : "";
      const claims = verifyToken(token, "access");
      const account = await AccountModel.findOne({
        _id: claims.sub,
        restaurantId: claims.restaurantId,
        active: true
      }).select("+tokenVersion");
      if (!account || account.tokenVersion !== claims.tokenVersion) throw new Error("revoked socket token");
      socket.data.auth = {
        ...claims,
        role: account.role,
        permissions: [...account.permissions]
      };
      return next();
    } catch {
      return next(new Error("Unauthorized socket"));
    }
  });

  socketServer.on("connection", (socket) => {
    const claims = socket.data.auth as { restaurantId: string; role: Role; sub: string };
    socket.join(`role:${claims.restaurantId}:${claims.role}`);
    socket.join(`account:${claims.restaurantId}:${claims.sub}`);
  });

  return socketServer;
}

export function emitToRole(restaurantId: string, role: Role, event: string, payload: unknown): void {
  socketServer?.to(`role:${restaurantId}:${role}`).emit(event, payload);
}

export function emitToAccount(restaurantId: string, accountId: string, event: string, payload: unknown): void {
  socketServer?.to(`account:${restaurantId}:${accountId}`).emit(event, payload);
}

export function disconnectAccountSockets(restaurantId: string, accountId: string): void {
  socketServer?.in(`account:${restaurantId}:${accountId}`).disconnectSockets(true);
}
