export * from "./client";
export * from "./mapper";
// Re-exported so a caller of sendGmailMessage (ADR 0056) can distinguish a
// real, safely-redacted Gmail rejection from an ambiguous/network failure —
// see approve-message-reply-action.ts, apps/web.
export { UpstreamProviderError } from "../shared/upstream-error";
