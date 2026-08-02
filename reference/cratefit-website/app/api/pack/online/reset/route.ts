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
import { resetSession, getSessionState } from "@/lib/online-sessions";
import { resetRequestSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  const key = getRateLimitKey(request);
  const { allowed, remaining, resetTime } = checkRateLimit(key);

  if (!allowed) {
    return rateLimitResponse(resetTime);
  }

  // Validate input with Zod (early exit on invalid input)
  const validation = await validateRequest(request, resetRequestSchema);

  if (!validation.success) {
    return validationErrorResponse(validation.error);
  }

  const { sessionId } = validation.data;

  try {
    // Reset the session (clears packer and re-adds the original bin)
    const resetSuccess = resetSession(sessionId);
    if (!resetSuccess) {
      return errorResponse("Session not found or expired", 404);
    }

    const state = getSessionState(sessionId);

    // Handle race condition where session expires during reset
    if (!state) {
      return errorResponse("Session expired during reset", 404);
    }

    return successResponse(
      {
        reset: true,
        ...state,
      },
      {
        "X-RateLimit-Remaining": String(remaining),
      }
    );
  } catch (error) {
    logApiError("Online pack reset error", error, key);
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500
    );
  }
}
