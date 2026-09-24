import type { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../lib/errors.js";

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new AppError(404, "ROUTE_NOT_FOUND", `No route matches ${request.method} ${request.originalUrl}`));
};

function duplicateKeyError(error: unknown): error is { code: number; keyValue?: Record<string, unknown> } {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === 11000;
}

function malformedJsonError(error: unknown): boolean {
  if (!(error instanceof SyntaxError) || typeof error !== "object" || error === null) return false;
  const parserError = error as SyntaxError & { status?: unknown; type?: unknown };
  return parserError.status === 400 && parserError.type === "entity.parse.failed";
}

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {

  let normalized: AppError;

  if (error instanceof AppError) {
    normalized = error;
  } else if (error instanceof mongoose.Error.ValidationError) {
    normalized = new AppError(400, "DATABASE_VALIDATION_ERROR", "Stored data validation failed");
  } else if (malformedJsonError(error)) {
    normalized = new AppError(400, "INVALID_JSON", "The request body must contain valid JSON");
  } else if (error instanceof mongoose.Error.CastError) {
    normalized = new AppError(400, "INVALID_IDENTIFIER", "A resource identifier is invalid");
  } else if (error instanceof mongoose.Error.VersionError) {
    normalized = new AppError(409, "ORDER_VERSION_CONFLICT", "This record changed; refresh and try again");
  } else if (duplicateKeyError(error)) {
    normalized = new AppError(409, "DUPLICATE_RESOURCE", "A record with that value already exists", error.keyValue);
  } else {
    normalized = new AppError(500, "INTERNAL_ERROR", "An unexpected error occurred");
  }

  if (normalized.statusCode >= 500) {
    logger.error({ err: error, requestId: request.requestId }, "Unhandled API error");
  }

  response.status(normalized.statusCode).json({
    success: false,
    error: {
      code: normalized.code,
      message: normalized.statusCode >= 500 && env.NODE_ENV === "production" ? "Internal server error" : normalized.message,
      ...(normalized.details ? { details: normalized.details } : {}),
      requestId: request.requestId
    }
  });
};
