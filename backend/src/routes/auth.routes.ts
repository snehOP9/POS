import { Router } from "express";

import { env } from "../config/env.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { unauthorized } from "../lib/errors.js";
import { sendSuccess } from "../lib/response.js";
import { requireAuth, authContext } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { AccountModel } from "../models/Account.js";
import { issueTokens, passwordMatches, publicAccount, verifyToken, hashPassword } from "../services/auth.service.js";
import { disconnectAccountSockets } from "../services/socket.service.js";
import { loginRequestSchema, logoutRequestSchema, refreshRequestSchema } from "./schemas.js";

const refreshCookieName = "emberserve_refresh";

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "lax" as const,
    path: "/api/v1/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    ...(env.cookieDomain ? { domain: env.cookieDomain } : {})
  };
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  return header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function userPayload(account: Parameters<typeof publicAccount>[0]) {
  const user = publicAccount(account);
  return { ...user, name: user.displayName };
}

export const authRouter = Router();

authRouter.post("/login", validateRequest(loginRequestSchema), asyncHandler(async (request, response) => {
  const { email, password } = request.body as { email: string; password: string };
  const account = await AccountModel.findOne({ email: email.toLowerCase() }).select("+passwordHash +refreshTokenHash +tokenVersion");
  if (!account || !account.active || !(await passwordMatches(password, account.passwordHash))) {
    throw unauthorized("AUTH_INVALID_CREDENTIALS", "Email or password is incorrect");
  }
  const tokens = issueTokens(account);
  account.refreshTokenHash = await hashPassword(tokens.refreshToken);
  await account.save();
  response.cookie(refreshCookieName, tokens.refreshToken, refreshCookieOptions());
  sendSuccess(response, { accessToken: tokens.accessToken, user: userPayload(account) });
}));

authRouter.post("/refresh", validateRequest(refreshRequestSchema), asyncHandler(async (request, response) => {
  const rawRefreshToken = cookieValue(request.header("cookie"), refreshCookieName);
  if (!rawRefreshToken) throw unauthorized("AUTH_REFRESH_MISSING", "Refresh credential is missing");
  const claims = verifyToken(rawRefreshToken, "refresh");
  const account = await AccountModel.findOne({
    _id: claims.sub,
    restaurantId: claims.restaurantId,
    active: true
  }).select("+refreshTokenHash +tokenVersion");
  if (!account || !account.refreshTokenHash || account.tokenVersion !== claims.tokenVersion) {
    throw unauthorized("AUTH_SESSION_REVOKED", "This session is no longer active");
  }
  if (!(await passwordMatches(rawRefreshToken, account.refreshTokenHash))) {
    throw unauthorized("AUTH_SESSION_REVOKED", "This refresh credential has been replaced");
  }
  const tokens = issueTokens(account);
  account.refreshTokenHash = await hashPassword(tokens.refreshToken);
  await account.save();
  response.cookie(refreshCookieName, tokens.refreshToken, refreshCookieOptions());
  sendSuccess(response, { accessToken: tokens.accessToken, user: userPayload(account) });
}));

authRouter.post("/logout", requireAuth, validateRequest(logoutRequestSchema), asyncHandler(async (request, response) => {
  const actor = authContext(request);
  await AccountModel.updateOne(
    { _id: actor.accountId, restaurantId: actor.restaurantId },
    { $inc: { tokenVersion: 1 }, $unset: { refreshTokenHash: 1 } }
  );
  disconnectAccountSockets(actor.restaurantId, actor.accountId);
  response.clearCookie(refreshCookieName, refreshCookieOptions());
  sendSuccess(response, { loggedOut: true });
}));

authRouter.get("/me", requireAuth, asyncHandler(async (request, response) => {
  const actor = authContext(request);
  const account = await AccountModel.findOne({ _id: actor.accountId, restaurantId: actor.restaurantId, active: true });
  if (!account) throw unauthorized("AUTH_SESSION_REVOKED", "This session is no longer active");
  sendSuccess(response, { user: userPayload(account) });
}));
