import { NextRequest } from "next/server";
import {
  getRateLimitKey,
  checkRateLimit,
  rateLimitResponse,
  errorResponse,
  validationErrorResponse,
  successResponse,
  validateQuery,
  logApiError,
} from "@/lib/api";
import { getSessionState } from "@/lib/online-sessions";
import { stateQuerySchema } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  const key = getRateLimitKey(request);
  const { allowed, remaining, resetTime } = checkRateLimit(key);

  if (!allowed) {
    return rateLimitResponse(resetTime);
  }

  // Validate query params with Zod (early exit on invalid input)
  const validation = validateQuery(
    request.nextUrl.searchParams,
    stateQuerySchema
  );

  if (!validation.success) {
    return validationErrorResponse(validation.error);
  }

  const { sessionId } = validation.data;

  try {
    const state = getSessionState(sessionId);
    if (!state) {
      return errorResponse("Session not found or expired", 404);
    }

    return successResponse(state, {
      "X-RateLimit-Remaining": String(remaining),
    });
  } catch (error) {
    logApiError("Online pack state error", error, key);
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500
    );
  }
}
