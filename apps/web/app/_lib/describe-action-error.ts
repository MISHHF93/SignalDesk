import { describeValidationError } from "@business-dashboard/schemas";

/**
 * A plain `error.message` on a thrown ZodError is a pretty-printed JSON
 * array of issues, not a sentence — shown directly in a Server Action's
 * error state, that reads as a raw stack dump instead of something a user
 * typed wrong. `describeValidationError` gives back a real sentence for a
 * validation error; anything else falls back to the plain Error message
 * (or the caller-supplied fallback).
 */
export function describeActionError(error: unknown, fallback: string): string {
  return (
    describeValidationError(error) ??
    (error instanceof Error ? error.message : fallback)
  );
}
