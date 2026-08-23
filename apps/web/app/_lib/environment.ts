/**
 * The one place this app decides "is a real, deployed visitor looking at
 * this, or is this a developer running the repository locally" —
 * customer-facing copy must never assume the latter. `NODE_ENV` is set to
 * `"development"` only by `next dev`; both `next build`+`next start` and
 * every real Vercel deployment (preview or production) run with
 * `NODE_ENV=production`, which is exactly the boundary that matters here:
 * a Vercel preview link is still something a real person other than the
 * developer might land on, so it gets the same customer-safe treatment as
 * the real production URL. Distinct from `SIGNALDESK_PUBLIC_LAUNCH_MODE`
 * (`instrumentation.ts`), which gates whether real customers may sign up
 * at all — this only gates which *wording* an unconfigured integration
 * shows, and applies before that later-stage flag is ever set.
 */
export function isLocalDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}
