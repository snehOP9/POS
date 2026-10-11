import rateLimit from "express-rate-limit";

export function createLoginRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, response) => {
      response.status(429).json({
        success: false,
        error: {
          code: "AUTH_RATE_LIMITED",
          message: "Too many login attempts. Please try again later"
        }
      });
    }
  });
}
