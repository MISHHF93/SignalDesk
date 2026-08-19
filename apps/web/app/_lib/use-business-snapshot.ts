"use client";

import { useCallback, useEffect, useState } from "react";

import type { BusinessSnapshot } from "@signaldesk/application";

/**
 * `BusinessSnapshot` over the wire — `GET /api/business/snapshot`
 * serializes every `Date` field to a JSON string; this reflects what
 * actually arrives at runtime rather than reusing `BusinessSnapshot`
 * itself and quietly lying about the field types.
 */
export type BusinessSnapshotJSON = Omit<
  BusinessSnapshot,
  "generatedAt" | "dataThroughAt"
> & {
  readonly generatedAt: string;
  readonly dataThroughAt: string;
};

export interface UseBusinessSnapshotResult {
  readonly snapshot: BusinessSnapshotJSON | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refresh: () => void;
}

/**
 * Client-side (re)fetch of the real snapshot — for a manual refresh
 * control, not the initial page load. `page.tsx` renders the same real
 * data server-side via `getBusinessSnapshot` directly; routing the
 * initial render through this hook/API round trip would only add
 * latency. There is no automatic polling or cross-tab cache here — this
 * app has no client-side cache library (no SWR/react-query dependency
 * exists), so "cache/invalidation" today just means "the caller decides
 * when to call `refresh`."
 */
export function useBusinessSnapshot(): UseBusinessSnapshotResult {
  const [snapshot, setSnapshot] = useState<BusinessSnapshotJSON | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

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

    void load();

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const refresh = useCallback(() => {
    setRefreshToken((token) => token + 1);
  }, []);

  return { snapshot, isLoading, error, refresh };
}
