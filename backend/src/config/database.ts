import mongoose from "mongoose";

import { env } from "./env.js";
import { logger } from "./logger.js";

mongoose.set("strictQuery", true);

export async function connectDatabase(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI, {
    autoIndex: env.NODE_ENV !== "production"
  });
  logger.info({ database: mongoose.connection.name }, "MongoDB connected");
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function databaseStatus(): "connected" | "disconnected" {
  return mongoose.connection.readyState === 1 ? "connected" : "disconnected";
}
