import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";

import { env } from "../config/env.js";
import { PERMISSIONS, ROLES, type Permission, type Role } from "../domain/access.js";
import { unauthorized } from "../lib/errors.js";
import type { Account } from "../models/Account.js";

export interface TokenClaims {
  sub: string;
  restaurantId: string;
  role: Role;
  permissions: Permission[];
  tokenVersion: number;
  type: "access" | "refresh";
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

type TokenAccount = Pick<Account, "restaurantId" | "role" | "permissions" | "tokenVersion"> & { _id: { toString(): string } };

const claimsSchema = z.object({
  sub: z.string().min(1),
  restaurantId: z.string().regex(/^[a-f\d]{24}$/i),
  role: z.enum(ROLES),
  permissions: z.array(z.enum(PERMISSIONS)),
  tokenVersion: z.number().int().nonnegative(),
  type: z.enum(["access", "refresh"])
});

function sign(account: TokenAccount, type: TokenClaims["type"]): string {
  const payload: TokenClaims = {
    sub: account._id.toString(),
    restaurantId: account.restaurantId.toString(),
    role: account.role,
    permissions: account.permissions,
    tokenVersion: account.tokenVersion,
    type
  };
  const expiresIn = (type === "access" ? env.ACCESS_TOKEN_TTL : env.REFRESH_TOKEN_TTL) as SignOptions["expiresIn"];
  const secret = type === "access" ? env.JWT_ACCESS_SECRET : env.JWT_REFRESH_SECRET;
  return jwt.sign(payload, secret, {
    expiresIn,
    issuer: "emberserve-api",
    audience: "emberserve-pos"
  });
}

export function issueTokens(account: TokenAccount): Tokens {
  return {
    accessToken: sign(account, "access"),
    refreshToken: sign(account, "refresh")
  };
}

export function verifyToken(token: string, expectedType: TokenClaims["type"]): TokenClaims {
  try {
    const secret = expectedType === "access" ? env.JWT_ACCESS_SECRET : env.JWT_REFRESH_SECRET;
    const decoded = jwt.verify(token, secret, {
      issuer: "emberserve-api",
      audience: "emberserve-pos"
    });
    const parsed = claimsSchema.safeParse(decoded);
    if (!parsed.success || parsed.data.type !== expectedType) throw new Error("invalid claims");
    return parsed.data;
  } catch {
    throw unauthorized("AUTH_INVALID_TOKEN", "Your session is invalid or has expired");
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function passwordMatches(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function publicAccount(account: Pick<Account, "email" | "displayName" | "role" | "permissions" | "active"> & { _id: { toString(): string } }) {
  return {
    id: account._id.toString(),
    email: account.email,
    displayName: account.displayName,
    role: account.role,
    permissions: account.permissions,
    active: account.active
  };
}
