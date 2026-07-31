import type { RequestHandler } from "express";
import { z } from "zod";

import { badRequest } from "../lib/errors.js";

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "must be a valid object id");
export const paiseSchema = z.number().int().min(0).max(10_000_000_00);

export function validateRequest<T extends z.ZodTypeAny>(schema: T): RequestHandler {
  return (request, _response, next) => {
    const parsed = schema.safeParse({
      body: request.body,
      params: request.params,
      query: request.query
    });

    if (!parsed.success) {
      return next(
        badRequest("VALIDATION_ERROR", "Request validation failed", {
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        })
      );
    }

    const input = parsed.data as { body?: unknown; params?: unknown; query?: unknown };
    if (input.body !== undefined) request.body = input.body;
    if (input.params !== undefined) request.params = input.params as typeof request.params;
    if (input.query !== undefined) request.query = input.query as typeof request.query;
    return next();
  };
}
