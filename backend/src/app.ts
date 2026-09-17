import { randomUUID } from "node:crypto";

import compression from "compression";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { databaseStatus } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";
import { requireAuth } from "./middleware/auth.js";
import { cashierRouter } from "./routes/cashier.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { kitchenRouter } from "./routes/kitchen.routes.js";
import { menuRouter } from "./routes/menu.routes.js";
import { notificationsRouter } from "./routes/notifications.routes.js";
import { ordersRouter } from "./routes/orders.routes.js";
import { paymentsRouter, razorpayWebhookHandler } from "./routes/payments.routes.js";
import { reportsRouter } from "./routes/reports.routes.js";
import { shiftsRouter } from "./routes/shifts.routes.js";
import { tablesRouter } from "./routes/tables.routes.js";
import { waiterRouter } from "./routes/waiter.routes.js";

function limiterHandler(_request: express.Request, response: express.Response): void {
  response.status(429).json({
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many requests; please try again shortly" }
  });
}

export function createApp() {
  const app = express();
  if (env.TRUST_PROXY) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use((request: express.Request, response: express.Response, next: express.NextFunction) => {
    request.requestId = request.header("x-request-id") ?? randomUUID();
    response.setHeader("X-Request-Id", request.requestId);
    response.on("finish", () => {
      logger.info({ requestId: request.requestId, method: request.method, path: request.originalUrl, statusCode: response.statusCode }, "HTTP request completed");
    });
    next();
  });
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: env.clientUrls, credentials: true }));
  app.use(compression());
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: "draft-8", legacyHeaders: false, handler: limiterHandler }));

  app.get("/health", (_request, response) => {
    response.status(200).json({
      success: true,
      data: {
        status: "ok",
        service: "emberserve-api",
        timestamp: new Date().toISOString()
      }
    });
  });

  app.get("/health/ready", requireAuth, (_request, response) => {
    const database = databaseStatus();
    const healthy = database === "connected";
    response.status(healthy ? 200 : 503).json({
      success: healthy,
      data: {
        status: healthy ? "ok" : "degraded",
        service: "emberserve-api",
        database,
        timestamp: new Date().toISOString()
      }
    });
  });

  app.post("/api/v1/payments/razorpay/webhook", express.raw({ type: "application/json", limit: "1mb" }), razorpayWebhookHandler);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  const api = express.Router();
  api.use("/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false, handler: limiterHandler }), authRouter);
  api.use("/menu", menuRouter);
  api.use("/orders", ordersRouter);
  api.use("/tables", tablesRouter);
  api.use("/waiter", waiterRouter);
  api.use("/kitchen", kitchenRouter);
  api.use("/payments", paymentsRouter);
  api.use("/cashier", cashierRouter);
  api.use("/shifts", shiftsRouter);
  api.use("/reports", reportsRouter);
  api.use("/notifications", notificationsRouter);
  app.use("/api/v1", api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
