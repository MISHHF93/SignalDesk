import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { checkRateLimit } from "../src/rate-limit";
import { getTestPool } from "./support";

// Exercises checkRateLimit against the live database — the real
// replacement for apps/web/app/_lib/rate-limit.ts's old in-memory Map,
// which was documented as single-process-only. The concurrency test below
// is the one that actually matters: it proves the fix, not just that the
// happy path still works.
describe.skipIf(!process.env.DATABASE_URL)(
  "checkRateLimit (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("allows the first request for a fresh key", async () => {
      const key = `test:${randomUUID()}`;
      const result = await checkRateLimit(pool, key, 5, 60_000);

      expect(result).toEqual({ allowed: true, retryAfterSeconds: 0 });
    });

    it("allows exactly `limit` requests, then denies the next one", async () => {
      const key = `test:${randomUUID()}`;
      const limit = 3;

      for (let i = 0; i < limit; i += 1) {
        const result = await checkRateLimit(pool, key, limit, 60_000);
        expect(result.allowed).toBe(true);
      }

      const denied = await checkRateLimit(pool, key, limit, 60_000);

      expect(denied.allowed).toBe(false);
      expect(denied.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("resets once the window has elapsed", async () => {
      const key = `test:${randomUUID()}`;
      const windowMs = 100;

      const first = await checkRateLimit(pool, key, 1, windowMs);
      expect(first.allowed).toBe(true);

      const immediatelyAfter = await checkRateLimit(pool, key, 1, windowMs);
      expect(immediatelyAfter.allowed).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, windowMs + 50));

      const afterWindow = await checkRateLimit(pool, key, 1, windowMs);
      expect(afterWindow.allowed).toBe(true);
    });

    it("serializes concurrent callers instead of racing (the real bug this replaces)", async () => {
      const key = `test:${randomUUID()}`;
      const limit = 5;
      const concurrentCalls = 20;

      const results = await Promise.all(
        Array.from({ length: concurrentCalls }, () =>
          checkRateLimit(pool, key, limit, 60_000),
        ),
      );

      const allowedCount = results.filter((r) => r.allowed).length;

      // The in-memory Map version this replaces has no such guarantee across
      // instances; a single Postgres row with an atomic UPSERT does, even
      // for 20 truly concurrent callers against one process.
      expect(allowedCount).toBe(limit);
    });

    it("keeps independent keys fully isolated", async () => {
      const keyA = `test:${randomUUID()}`;
      const keyB = `test:${randomUUID()}`;

      await checkRateLimit(pool, keyA, 1, 60_000);
      const deniedA = await checkRateLimit(pool, keyA, 1, 60_000);
      const allowedB = await checkRateLimit(pool, keyB, 1, 60_000);

      expect(deniedA.allowed).toBe(false);
      expect(allowedB.allowed).toBe(true);
    });
  },
);
