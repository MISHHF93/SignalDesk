"use client";

import { useCallback, useEffect, useState } from "react";

import type { BusinessSnapshot } from "@signaldesk/application";

/**
 * Recursively replaces every `Date` with `string` — what `JSON.stringify`
 * (via `NextResponse.json`) actually does to any nested `Date`, not just
 * top-level ones. A previous version of this type only fixed
 * `generatedAt`/`dataThroughAt` and left every *nested* `Date` (findings'
 * `detectedAt`, `freshness.asOf`, `evidence[].lastSyncedAt`;
 * `recentActions`/`meaningfulChanges`/`approvals`' own timestamp
 * fields) still typed as `Date` — a real, shipped type/runtime mismatch
 * a future caller doing `.getTime()` on any of those would have hit
 * with a "not a function" crash despite TypeScript reporting it as
 * safe (found in a type-safety audit this session). A hand-mirrored
 * type would have the same class of bug reappear the next time
 * `BusinessSnapshot` gains a field; this stays correct automatically.
 */
type ReplaceDatesWithStrings<T> = T extends Date
  ? string
  : T extends readonly (infer Item)[]
    ? readonly ReplaceDatesWithStrings<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: ReplaceDatesWithStrings<T[Key]> }
      : T;

/**
 * `BusinessSnapshot` over the wire — `GET /api/business/snapshot`
 * serializes every `Date` field to a JSON string; this reflects what
 * actually arrives at runtime rather than reusing `BusinessSnapshot`
 * itself and quietly lying about the field types.
 */
export type BusinessSnapshotJSON = ReplaceDatesWithStrings<BusinessSnapshot>;

export type SnapshotCard = BusinessSnapshotJSON["cards"][number];
export type SnapshotRecentAction =
  BusinessSnapshotJSON["recentActions"][number];

export interface UseBusinessSnapshotOptions {
  /**
   * When set, the snapshot re-fetches itself on this interval in the
   * background (no `isLoading` flicker — only the very first load and an
   * explicit `refresh()` call show loading state) — the real prerequisite
   * for the command center to reflect new findings without a manual page
   * reload (Phase 2 of the implementation roadmap). Reuses this same
   * already-real, already-rate-limited endpoint rather than a second,
   * parallel one; the interval itself stays well above the route's
   * 30-per-minute rate limit (`api/business/snapshot/route.ts`) for any
   * sane value. Omit for the previous manual-refresh-only behavior.
   */
  readonly pollIntervalMs?: number;
}

export interface UseBusinessSnapshotResult {
  readonly snapshot: BusinessSnapshotJSON | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refresh: () => void;
}

/**
 * Client-side (re)fetch of the real snapshot — for a manual refresh
 * control and, when `pollIntervalMs` is given, background polling.
 * `page.tsx` renders the same real data server-side via
 * `getBusinessSnapshot` directly for the *initial* render; routing that
 * through this hook/API round trip would only add latency. Every
 * subsequent update (manual refresh or a poll tick) does go through this
 * real endpoint, since a Server Component can't re-render itself on a
 * timer.
 */
export function useBusinessSnapshot(
  options: UseBusinessSnapshotOptions = {},
): UseBusinessSnapshotResult {
  const { pollIntervalMs } = options;
  const [snapshot, setSnapshot] = useState<BusinessSnapshotJSON | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load(isBackgroundRefresh: boolean) {
      if (!isBackgroundRefresh) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const response = await fetch("/api/business/snapshot");

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? `Request failed (${response.status})`);
        }

        const data = (await response.json()) as BusinessSnapshotJSON;

        if (!cancelled) {
          setSnapshot(data);
          // A poll tick that succeeds after an earlier one failed should
          // clear the stale error, the same way it would for a manual
          // refresh.
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Failed to load the business snapshot.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load(false);

    if (!pollIntervalMs) {
      return () => {
        cancelled = true;
      };
    }

    const intervalId = setInterval(() => {
      void load(true);
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [refreshToken, pollIntervalMs]);

  const refresh = useCallback(() => {
    setRefreshToken((token) => token + 1);
  }, []);

  return { snapshot, isLoading, error, refresh };
}
