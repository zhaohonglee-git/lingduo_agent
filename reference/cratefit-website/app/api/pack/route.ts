import { NextRequest } from "next/server";
import { pack } from "@cratefit/pack";
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
import { packRequestSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  // Rate limiting (backup for Vercel WAF)
  const key = getRateLimitKey(request);
  const { allowed, remaining, resetTime } = checkRateLimit(key);

  if (!allowed) {
    return rateLimitResponse(resetTime);
  }

  // Validate input with Zod (early exit on invalid input)
  const validation = await validateRequest(request, packRequestSchema);

  if (!validation.success) {
    return validationErrorResponse(validation.error);
  }

  const { bins, items, options } = validation.data;

  try {
    // Execute packing
    const result = pack({
      bins,
      items,
      options,
    });

    return successResponse(result, {
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(Math.ceil(resetTime / 1000)),
    });
  } catch (error) {
    logApiError("Pack API error", error, key);
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500
    );
  }
}
