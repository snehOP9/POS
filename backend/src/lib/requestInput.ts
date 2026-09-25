import type { Request } from "express";

import { badRequest } from "./errors.js";
export function validatedQuery<T>(request: Request): T {
  return request.query as unknown as T;
}

export function validatedParam(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== "string") {
    throw badRequest("VALIDATION_ERROR", `Route parameter ${name} is invalid`);
  }
  return value;
}
