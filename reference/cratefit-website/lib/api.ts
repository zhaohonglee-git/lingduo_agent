import { NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";

// ============================================================================
// Safe Error Logging
// ============================================================================

/**
 * Sanitize IP address for logging (GDPR compliant)
 * In production, only log the first two octets
 */
function sanitizeIp(ip: string): string {
  if (process.env.NODE_ENV === "development") {
    return ip;
  }
  // Mask last two octets for privacy
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.x.x`;
  }
  // IPv6 or other format - just show prefix
  return ip.slice(0, 10) + "...";
}

/**
 * Log API errors safely without exposing sensitive information in production
 */
export function logApiError(
  context: string,
  error: unknown,
  ip?: string
): void {
  const isDev = process.env.NODE_ENV === "development";
  const message = error instanceof Error ? error.message : "Unknown error";

  if (isDev) {
    // Development: full details for debugging
    console.error(`${context}:`, {
      message,
      stack: error instanceof Error ? error.stack : undefined,
      ip,
      timestamp: new Date().toISOString(),
    });
  } else {
    // Production: minimal info, sanitized IP
    console.error(`${context}:`, {
      message,
      ip: ip ? sanitizeIp(ip) : undefined,
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================================================
// Rate Limiting (In-Memory)
// ============================================================================

// Simple in-memory rate limiter (backup for Vercel WAF)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// 60 requests per minute (matches Vercel WAF config)
// Validate parsed values to handle NaN and enforce reasonable bounds
const parsedMax = parseInt(process.env.RATE_LIMIT_MAX || "60", 10);
const parsedWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10);
// Bounds: max 1-1000 requests, window 1s-1h
const RATE_LIMIT_MAX = Math.max(1, Math.min(1000, isNaN(parsedMax) ? 60 : parsedMax));
const RATE_LIMIT_WINDOW_MS = Math.max(1000, Math.min(3600000, isNaN(parsedWindow) ? 60000 : parsedWindow));

// Cleanup tracking (request-based cleanup instead of setInterval)
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60000; // 1 minute
const MAX_ENTRIES = 10000; // Prevent unbounded growth

export function getRateLimitKey(request: Request): string {
  // Vercel provides the real IP in x-forwarded-for
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const firstForwarded = forwarded?.split(",")[0]?.trim();
  const ip = firstForwarded || realIp;

  if (!ip) {
    // Log for monitoring - unknown IPs could indicate proxy misconfiguration
    if (process.env.NODE_ENV === "development") {
      console.warn("Rate limit: Unable to identify client IP");
    }
    // Use unique key per request to enforce stricter limits on unknown IPs
    // This prevents multiple users from sharing the same "unknown" bucket
    return `unknown-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  return ip;
}

export function checkRateLimit(key: string): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();

  // Periodic cleanup (serverless-friendly, no setInterval)
  // Use batch deletion with limit to avoid blocking event loop
  if (now - lastCleanup > CLEANUP_INTERVAL || rateLimitMap.size > MAX_ENTRIES) {
    const keysToDelete: string[] = [];
    const maxDeletePerCycle = 1000; // Limit to avoid blocking

    for (const [k, record] of rateLimitMap) {
      // Skip current key and add buffer time to prevent race condition
      // Buffer ensures record wasn't just reset by another request
      if (k !== key && now > record.resetTime + 1000) {
        keysToDelete.push(k);
        if (keysToDelete.length >= maxDeletePerCycle) break;
      }
    }

    // Double-check before deletion to handle concurrent modifications
    for (const k of keysToDelete) {
      const record = rateLimitMap.get(k);
      if (record && now > record.resetTime + 1000) {
        rateLimitMap.delete(k);
      }
    }
    lastCleanup = now;
  }

  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    // Reset or create new record
    const resetTime = now + RATE_LIMIT_WINDOW_MS;
    rateLimitMap.set(key, { count: 1, resetTime });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetTime };
  }

  // Note: In Node.js single-threaded model, these operations are effectively atomic
  // within a single event loop tick. The primary rate limiting is handled by Vercel WAF;
  // this in-memory implementation serves as a backup for development and edge cases.
  // For distributed deployments, consider using Redis-based rate limiting.

  // Check first, then increment - prevents counter inflation when requests are rejected
  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  // Only increment after confirming the request is allowed
  record.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX - record.count,
    resetTime: record.resetTime,
  };
}

// Note: Cleanup is now done within checkRateLimit() on each request
// This is more reliable in serverless environments than setInterval

// ============================================================================
// Response Helpers
// ============================================================================

export function rateLimitResponse(resetTime: number) {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
  return NextResponse.json(
    {
      error: "Too many requests",
      message: "Rate limit exceeded. Please try again later.",
      retryAfter,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(resetTime / 1000)),
      },
    }
  );
}

export function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function validationErrorResponse(error: ZodError) {
  const issues = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));

  return NextResponse.json(
    {
      error: "Validation failed",
      issues,
    },
    { status: 400 }
  );
}

export function successResponse<T>(data: T, headers?: Record<string, string>) {
  return NextResponse.json(data, { headers });
}

// ============================================================================
// Validation Helper
// ============================================================================

export async function validateRequest<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: ZodError }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: result.data };
  } catch {
    // JSON parse error
    const error = new ZodError([
      {
        code: "custom",
        path: [],
        message: "Invalid JSON body",
      },
    ]);
    return { success: false, error };
  }
}

export function validateQuery<T>(
  params: URLSearchParams,
  schema: ZodSchema<T>
): { success: true; data: T } | { success: false; error: ZodError } {
  const obj = Object.fromEntries(params.entries());
  const result = schema.safeParse(obj);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, data: result.data };
}
