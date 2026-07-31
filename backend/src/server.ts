import http from "node:http";

import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { initializeSocket } from "./services/socket.service.js";

async function bootstrap(): Promise<void> {
  await connectDatabase();
  const app = createApp();
  const server = http.createServer(app);
  initializeSocket(server);

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutting down API server");
    server.close(async (error) => {
      if (error) {
        logger.error({ err: error }, "HTTP server shutdown failed");
        process.exitCode = 1;
      }
      await disconnectDatabase();
      process.exit();
    });
  };
  process.once("SIGINT", () => { void shutdown("SIGINT"); });
  process.once("SIGTERM", () => { void shutdown("SIGTERM"); });

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, environment: env.NODE_ENV }, "EmberServe API listening");
  });
}

bootstrap().catch((error: unknown) => {
  logger.fatal({ err: error }, "Unable to start EmberServe API");
  process.exitCode = 1;
});
