import { NextRequest } from "next/server";
import {
  getRateLimitKey,
  checkRateLimit,
  rateLimitResponse,
  errorResponse,
  validationErrorResponse,
  successResponse,
  validateRequest,
  logApiError,
} from "@/lib/api";
import { createSession, getSessionState } from "@/lib/online-sessions";
import { startRequestSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  const key = getRateLimitKey(request);
  const { allowed, remaining, resetTime } = checkRateLimit(key);

  if (!allowed) {
    return rateLimitResponse(resetTime);
  }

  // Validate input with Zod (early exit on invalid input)
  const validation = await validateRequest(request, startRequestSchema);

  if (!validation.success) {
    return validationErrorResponse(validation.error);
  }

  const { bin } = validation.data;

  try {
    const sessionId = createSession(bin);
    const state = getSessionState(sessionId);

    return successResponse(
      {
        sessionId,
        ...state,
      },
      {
        "X-RateLimit-Remaining": String(remaining),
      }
    );
  } catch (error) {
    logApiError("Online pack start error", error, key);
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500
    );
  }
}
