import pino from "pino";

import { env } from "./env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "emberserve-api" },
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "password",
    "passwordHash",
    "refreshToken",
    "refreshTokenHash",
    "razorpaySignature"
  ]
});
