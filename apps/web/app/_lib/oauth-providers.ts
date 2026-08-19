export type OAuthProviderId =
  "google" | "slack_oidc" | "linkedin_oidc" | "facebook";

export interface OAuthProviderDefinition {
  readonly id: OAuthProviderId;
  readonly label: string;
}

/**
 * The four providers requested for social sign-in. IDs match Supabase
 * Auth's provider identifiers exactly (`slack_oidc`/`linkedin_oidc`, not
 * the deprecated `slack`/`linkedin` — Supabase migrated both to OIDC).
 */
export const oauthProviders: readonly OAuthProviderDefinition[] = [
  { id: "google", label: "Google" },
  { id: "slack_oidc", label: "Slack" },
  { id: "linkedin_oidc", label: "LinkedIn" },
  { id: "facebook", label: "Facebook" },
];

const enabledProviders = new Set(
  (process.env.NEXT_PUBLIC_ENABLED_OAUTH_PROVIDERS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

/**
 * Whether a provider is actually usable. This flag does not configure
 * Supabase itself — it only controls whether the UI presents a real button
 * or an honest "not yet connected" state. A provider only works once a
 * real OAuth app is registered with that provider AND its Client
 * ID/Secret are entered in the Supabase dashboard (Authentication >
 * Providers) AND its id is added to `NEXT_PUBLIC_ENABLED_OAUTH_PROVIDERS`.
 */
export function isOAuthProviderEnabled(id: OAuthProviderId): boolean {
  return enabledProviders.has(id);
}
