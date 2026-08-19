import { headers } from "next/headers";

/**
 * A minimal, single-process, in-memory rate limiter — a stopgap, not
 * production infrastructure. State lives in module memory: it resets on
 * every server restart and does NOT share state across multiple
 * instances/serverless invocations, so it only meaningfully protects a
 * single long-running Node process. Real production rate limiting needs a
 * shared store (e.g. Upstash Redis). This exists so authentication
 * endpoints aren't completely unprotected in the meantime — Supabase's own
 * platform-level defaults (e.g. ~30 req/hr/IP on some Auth endpoints) are
 * the actual backstop today; this narrows the window further per-action.
 */

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(
        (windowMs - (now - bucket.windowStart)) / 1000,
      ),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Best-effort client IP from the standard proxy headers most hosting
 * platforms set. Falls back to a shared bucket key when absent (e.g. local
 * dev without a proxy in front) — that's strictly weaker than per-IP
 * limiting, not a security guarantee, which is why this whole module is a
 * stopgap rather than the real answer.
 */
export async function getClientIp(): Promise<string> {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]!.trim();
  }

  return requestHeaders.get("x-real-ip") ?? "unknown";
}
