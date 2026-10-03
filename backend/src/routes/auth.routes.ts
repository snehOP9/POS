import { Router } from "express";
import rateLimit from "express-rate-limit";

import { env } from "../config/env.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { conflict, unauthorized } from "../lib/errors.js";
import { sendSuccess } from "../lib/response.js";
import { requireAuth, authContext } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { AccountModel } from "../models/Account.js";
import { issueTokens, passwordMatches, publicAccount, verifyToken, hashPassword } from "../services/auth.service.js";
import { guestAccountEmail, guestAccountPassword, requestCustomerOtp, verifyCustomerOtp } from "../services/customer-otp.service.js";
import { getSingleRestaurant } from "../services/restaurant.service.js";
import { disconnectAccountSockets } from "../services/socket.service.js";
import { customerOtpRequestSchema, customerOtpVerifySchema, loginRequestSchema, logoutRequestSchema, refreshRequestSchema } from "./schemas.js";

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

const customerOtpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_request, response) => response.status(429).json({ success: false, error: { code: "OTP_RATE_LIMITED", message: "Too many codes requested. Please wait a few minutes before trying again." } })
});

const customerOtpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_request, response) => response.status(429).json({ success: false, error: { code: "OTP_RATE_LIMITED", message: "Too many verification attempts. Please request a new code and try again later." } })
});

authRouter.post("/login", validateRequest(loginRequestSchema), asyncHandler(async (request, response) => {
  const { email, password } = request.body as { email: string; password: string };
  const account = await AccountModel.findOne({ email: email.toLowerCase() }).select("+passwordHash +refreshTokenHash +tokenVersion");
  if (!account || !account.active || !(await passwordMatches(password, account.passwordHash))) {
    throw unauthorized("AUTH_INVALID_CREDENTIALS", "Email or password is incorrect");
  }
  if (account.role === "CUSTOMER") {
    throw unauthorized("CUSTOMER_MOBILE_VERIFICATION_REQUIRED", "Guest access uses mobile verification. Return to the menu to confirm your mobile number.");
  }
  const tokens = issueTokens(account);
  account.refreshTokenHash = await hashPassword(tokens.refreshToken);
  await account.save();
  response.cookie(refreshCookieName, tokens.refreshToken, refreshCookieOptions());
  sendSuccess(response, { accessToken: tokens.accessToken, user: userPayload(account) });
}));

authRouter.post("/customer/otp/request", customerOtpRequestLimiter, validateRequest(customerOtpRequestSchema), asyncHandler(async (request, response) => {
  const { phone } = request.body as { phone: string };
  await requestCustomerOtp(phone);
  sendSuccess(response, { channel: "sms", expiresInSeconds: 600, phoneEnding: phone.slice(-4) });
}));

authRouter.post("/customer/otp/verify", customerOtpVerifyLimiter, validateRequest(customerOtpVerifySchema), asyncHandler(async (request, response) => {
  const { phone, code } = request.body as { phone: string; code: string };
  await verifyCustomerOtp(phone, code);

  const restaurant = await getSingleRestaurant();
  let account = await AccountModel.findOne({ restaurantId: restaurant._id, phone }).select("+passwordHash +refreshTokenHash +tokenVersion");
  if (account && account.role !== "CUSTOMER") {
    throw conflict("MOBILE_ACCOUNT_CONFLICT", "This mobile number cannot be used for guest ordering. Please contact the restaurant.");
  }
  if (!account) {
    try {
      account = await AccountModel.create({
        restaurantId: restaurant._id,
        email: guestAccountEmail(phone),
        phone,
        displayName: "Guest",
        passwordHash: await hashPassword(guestAccountPassword()),
        role: "CUSTOMER",
        permissions: [],
        active: true
      });
    } catch (error: unknown) {
      const duplicateKeyError = error as { code?: unknown };
      if (duplicateKeyError.code !== 11000) throw error;
      account = await AccountModel.findOne({ restaurantId: restaurant._id, phone }).select("+passwordHash +refreshTokenHash +tokenVersion");
      if (!account || account.role !== "CUSTOMER") throw error;
    }
  }
  if (!account.active) throw unauthorized("AUTH_SESSION_REVOKED", "This guest account is no longer active");
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
