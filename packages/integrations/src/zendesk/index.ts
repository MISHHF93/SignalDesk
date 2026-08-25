export * from "./client";
export * from "./mapper";
// Re-exported so a caller of postZendeskTicketReply can distinguish a
// real, safely-redacted Zendesk rejection from an ambiguous/network
// failure — see approve-ticket-reply-action.ts, apps/web (being built in
// parallel; matches the same pattern asana/index.ts and gmail/index.ts
// already use for their own real writes).
export { UpstreamProviderError } from "../shared/upstream-error";
