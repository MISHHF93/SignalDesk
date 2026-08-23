import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withAdvisoryLock } from "../src/advisory-lock";
import type { DatabasePool } from "../src/client";
import { getTestPool } from "./support";

// Exercises withAdvisoryLock against the live database — the real
// replacement for start-checkout.ts's old in-memory Set, which was
// single-process-only. The concurrency test is the one that proves the
// fix: a real Postgres advisory lock is visible across every connection
// hitting the same database, not just within one Node process.
describe.skipIf(!process.env.DATABASE_URL)(
  "withAdvisoryLock (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("runs fn and returns its result when the lock is free", async () => {
      const key = `test:${randomUUID()}`;

      const result = await withAdvisoryLock(pool, key, async () => "done");

      expect(result).toBe("done");
    });

    it("releases the lock after fn completes, so a later call can acquire it again", async () => {
      const key = `test:${randomUUID()}`;

      const first = await withAdvisoryLock(pool, key, async () => "first");
      const second = await withAdvisoryLock(pool, key, async () => "second");

      expect(first).toBe("first");
      expect(second).toBe("second");
    });

    it("releases the lock even when fn throws", async () => {
      const key = `test:${randomUUID()}`;

      await expect(
        withAdvisoryLock(pool, key, async () => {
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");

      // If the lock had leaked, this second call would return null instead
      // of actually running.
      const after = await withAdvisoryLock(pool, key, async () => "recovered");

      expect(after).toBe("recovered");
    });

    it("returns null for a concurrent caller instead of queuing behind the first", async () => {
      const key = `test:${randomUUID()}`;
      let releaseFirst!: () => void;
      const firstIsHoldingLock = new Promise<void>((resolveHolding) => {
        void withAdvisoryLock(pool, key, async () => {
          resolveHolding();
          // Held open until the test explicitly releases it.
          await new Promise<void>((resolve) => {
            releaseFirst = resolve;
          });
          return "first";
        });
      });

      await firstIsHoldingLock;

      const concurrent = await withAdvisoryLock(
        pool,
        key,
        async () => "second",
      );
      expect(concurrent).toBeNull();

      releaseFirst();
      // Give the first call's finally block a tick to run its unlock query.
      await new Promise((resolve) => setTimeout(resolve, 50));

      const afterRelease = await withAdvisoryLock(
        pool,
        key,
        async () => "third",
      );
      expect(afterRelease).toBe("third");
    });

    it("keeps independent keys fully isolated", async () => {
      const keyA = `test:${randomUUID()}`;
      const keyB = `test:${randomUUID()}`;
      let releaseA!: () => void;

      void withAdvisoryLock(pool, keyA, async () => {
        await new Promise<void>((resolve) => {
          releaseA = resolve;
        });
        return "a";
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const resultB = await withAdvisoryLock(pool, keyB, async () => "b");
      expect(resultB).toBe("b");

      releaseA();
    });
  },
);
