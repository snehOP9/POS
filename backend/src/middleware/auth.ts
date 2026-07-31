import type { RequestHandler } from "express";

import type { Permission, Role } from "../domain/access.js";
import { forbidden, unauthorized } from "../lib/errors.js";
import { AccountModel } from "../models/Account.js";
import { verifyToken } from "../services/auth.service.js";
import { asyncHandler } from "../lib/asyncHandler.js";

function bearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw unauthorized();
  }
  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token) throw unauthorized();
  return token;
}

export const requireAuth: RequestHandler = asyncHandler(async (request, _response, _next) => {
  const claims = verifyToken(bearerToken(request.header("authorization")), "access");
  const account = await AccountModel.findOne({
    _id: claims.sub,
    restaurantId: claims.restaurantId,
    active: true
  }).select("+tokenVersion");

  if (!account || account.tokenVersion !== claims.tokenVersion) {
    throw unauthorized("AUTH_SESSION_REVOKED", "Your session is no longer active");
  }

  request.auth = {
    accountId: account._id.toString(),
    restaurantId: account.restaurantId.toString(),
    role: account.role,
    permissions: [...account.permissions],
    tokenVersion: account.tokenVersion
  };
});

export function requireRole(...roles: Role[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) return next(unauthorized());
    if (!roles.includes(request.auth.role)) return next(forbidden());
    return next();
  };
}

export function requirePermission(...permissions: Permission[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) return next(unauthorized());
    if (!permissions.every((permission) => request.auth?.permissions.includes(permission))) {
      return next(forbidden("AUTH_MISSING_PERMISSION", "Your role lacks the required permission"));
    }
    return next();
  };
}

export function authContext(request: Parameters<RequestHandler>[0]): NonNullable<Express.Request["auth"]> {
  if (!request.auth) throw unauthorized();
  return request.auth;
}
