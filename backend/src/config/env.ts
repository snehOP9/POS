import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { config as loadEnvironment } from "dotenv";

import { z } from "zod";

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
loadEnvironment({ path: resolve(sourceDirectory, "../../../.env") });

const booleanFromEnvironment = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_URL: z.string().min(1).default("http://localhost:5173"),
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, "must be a MongoDB URI"),
  JWT_ACCESS_SECRET: z.string().min(32, "must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "must be at least 32 characters"),
  ACCESS_TOKEN_TTL: z.string().min(2).default("15m"),
  REFRESH_TOKEN_TTL: z.string().min(2).default("7d"),
  RESTAURANT_TIMEZONE: z.string().default("Asia/Kolkata"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
  COOKIE_DOMAIN: z.string().trim().min(1).optional(),
  COOKIE_SECURE: booleanFromEnvironment.optional(),
  TRUST_PROXY: booleanFromEnvironment.optional().default("false"),
  ALLOW_PRODUCTION_SEED: booleanFromEnvironment.optional().default("false"),
  SEED_DEMO_PASSWORD: z.string().min(8).max(128).optional()
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const issues = parsedEnvironment.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid API environment configuration: ${issues}`);
}

export const env = {
  ...parsedEnvironment.data,
  clientUrls: parsedEnvironment.data.CLIENT_URL.split(",").map((url) => url.trim()).filter(Boolean),
  cookieSecure: parsedEnvironment.data.COOKIE_SECURE ?? parsedEnvironment.data.NODE_ENV === "production",
  cookieDomain: parsedEnvironment.data.COOKIE_DOMAIN === "localhost" ? undefined : parsedEnvironment.data.COOKIE_DOMAIN
} as const;
