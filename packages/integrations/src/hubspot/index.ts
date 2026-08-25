export * from "./client";
export * from "./mapper";
// Re-exported so a caller of createHubSpotDealNote can distinguish a real,
// safely-redacted HubSpot rejection from an ambiguous/network failure —
// see approve-deal-note-action.ts, apps/web (being built in parallel;
// matches the same pattern asana/index.ts, gmail/index.ts, and
// zendesk/index.ts already use for their own real writes).
export { UpstreamProviderError } from "../shared/upstream-error";
