import { createHash } from "node:crypto";

import rateLimit from "express-rate-limit";

type LoginLimiterOptions = {
  windowMs?: number;
  limit?: number;
};

export function createLoginAccountLimiter(options: LoginLimiterOptions = {}) {
  return rateLimit({
    windowMs: options.windowMs ?? 15 * 60 * 1000,
    limit: options.limit ?? 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (request) => {
      const email = typeof request.body?.email === "string"
        ? request.body.email.trim().toLowerCase()
        : "missing-email";
      const ip = request.ip ?? request.socket.remoteAddress ?? "unknown";
      return createHash("sha256").update(ip).update("\0").update(email).digest("hex");
    },
    handler: (_request, response) => {
      response.status(429).json({
        success: false,
        error: {
          code: "LOGIN_RATE_LIMITED",
          message: "Too many login attempts; try again later"
        }
      });
    }
  });
}

export const loginAccountLimiter = createLoginAccountLimiter();

// A separate per-IP budget limits account spraying even when emails vary.
export function createLoginIpLimiter(options: LoginLimiterOptions = {}) {
  return rateLimit({
    windowMs: options.windowMs ?? 15 * 60 * 1000,
    limit: options.limit ?? 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, response) => {
      response.status(429).json({
        success: false,
        error: {
          code: "LOGIN_RATE_LIMITED",
          message: "Too many login attempts; try again later"
        }
      });
    }
  });
}

export const loginIpLimiter = createLoginIpLimiter();
