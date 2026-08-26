"use server";

import { redirect } from "next/navigation";

import { createDatabasePool, type DatabasePool } from "@signaldesk/persistence";

import { createClient } from "../../lib/supabase/server";
import type { OAuthProviderId } from "../_lib/oauth-providers";
import { isOAuthProviderEnabled } from "../_lib/oauth-providers";
import { safeNextPath } from "../_lib/safe-next-path";
import { checkRateLimit, getClientIp } from "../_lib/rate-limit";
import { getRequestOrigin } from "../_lib/request-origin";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export interface AuthActionState {
  readonly error: string | null;
  readonly message?: string;
}

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `sign-in:${await getClientIp()}`,
    10,
    5 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return {
      error: `Too many sign-in attempts. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect(next);
}

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  if (password.length < 8) {
    return { error: "Your password must be at least 8 characters." };
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `sign-up:${await getClientIp()}`,
    5,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return {
      error: `Too many account creation attempts. Try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const next = safeNextPath(formData.get("next"));
  // A real, pending invite token (Phase 3, implementation roadmap) —
  // `options.data` becomes `auth.users.raw_user_meta_data`, the same
  // mechanism `handle_new_auth_user` (drizzle/0046) already reads
  // `full_name` from. An absent/blank token is `undefined` here, which
  // Supabase omits from the stored metadata entirely — the trigger's own
  // `raw_user_meta_data ->> 'invite_token'` then reads `null`, taking the
  // function's original, unchanged solo-organization path.
  const inviteToken = String(formData.get("inviteToken") ?? "").trim();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    ...(inviteToken
      ? { options: { data: { invite_token: inviteToken } } }
      : {}),
  });

  if (error) {
    return { error: error.message };
  }

  // A confirmed-email project returns a session immediately; a project that
  // requires email confirmation returns a user with no session yet.
  if (data.session) {
    redirect(next);
  }

  return {
    error: null,
    message: "Check your email to confirm your account, then sign in.",
  };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Requests a password-reset email. Always returns the same success
 * message regardless of whether the email actually belongs to an
 * account — Supabase's own `resetPasswordForEmail` already avoids
 * disclosing this (it doesn't return an error for an unknown email
 * either), and this action must not reintroduce an account-enumeration
 * side channel that the underlying API deliberately doesn't have.
 *
 * The reset link's `redirectTo` reuses the existing OAuth callback route
 * (`app/auth/callback/route.ts`) unmodified — Supabase's recovery link is
 * itself a PKCE `code` exchange, the exact shape that route already
 * handles generically, landing the user on `/login/reset/confirm` with a
 * real, authenticated (recovery) session already established.
 */
export async function requestPasswordResetAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Enter your email." };
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `password-reset:${await getClientIp()}`,
    5,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return {
      error: `Too many reset attempts. Try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minutes.`,
    };
  }

  // A validated origin, not the raw `Origin` request header — this becomes
  // a real link Supabase emails to whatever address was requested, so it
  // must never trust an attacker-suppliable value directly (the same
  // host-header-injection defense `getRequestOrigin` already applies for
  // `invite-member.ts`'s emailed accept link; a spoofed origin here would
  // be a real account-takeover vector, not just a phishing one, since the
  // recovery code itself would be redirected off-domain).
  const origin = await getRequestOrigin();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/login/reset/confirm")}`,
  });

  return {
    error: null,
    message:
      "If that email has an account, a password reset link is on its way.",
  };
}

/**
 * Sets a new password for the currently-authenticated session — real only
 * immediately after following a real reset-email link (which establishes a
 * short-lived recovery session via the callback route above); calling this
 * with no active session fails with Supabase's own "Auth session missing"
 * error, surfaced as-is rather than a fabricated success.
 */
export async function updatePasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    return { error: "Your new password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  redirect("/login?reset=1");
}

export interface GuestActionState {
  readonly error: string | null;
}

/**
 * Guest access (ADR 0009): a real Supabase anonymous sign-in, not an
 * auth-gate bypass. It goes through the same on_auth_user_created trigger
 * as any other signup, so a guest gets a real, isolated, RLS-scoped
 * organization. Requires "Allow anonymous sign-ins" to be enabled in the
 * Supabase dashboard (Authentication > Sign In / Providers) — no tool
 * available to this app can turn that on programmatically.
 */
export async function continueAsGuestAction(
  _prevState: GuestActionState,
  formData: FormData,
): Promise<GuestActionState> {
  const rateLimit = await checkRateLimit(
    getPool(),
    `guest:${await getClientIp()}`,
    5,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return {
      error: `Too many guest sessions from this connection. Try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const next = safeNextPath(formData.get("next"));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInAnonymously();

  if (error) {
    return { error: error.message };
  }

  redirect(next);
}

export interface OAuthActionState {
  readonly error: string | null;
}

/**
 * Starts the OAuth redirect flow for a provider. Only callable for a
 * provider `isOAuthProviderEnabled()` — the UI never renders a working
 * button for a provider that isn't (see `_components/oauth-buttons.tsx`),
 * but this is re-checked here too since a Server Action is an untrusted
 * POST endpoint. `app/auth/callback/route.ts` completes the flow.
 */
export async function signInWithOAuthAction(
  _prevState: OAuthActionState,
  formData: FormData,
): Promise<OAuthActionState> {
  const provider = String(formData.get("provider") ?? "") as OAuthProviderId;
  const next = safeNextPath(formData.get("next"));

  if (!isOAuthProviderEnabled(provider)) {
    return { error: "This sign-in method is not yet connected." };
  }

  // Same validated-origin defense as requestPasswordResetAction above —
  // this becomes the redirect target the OAuth provider sends the user's
  // browser back to with a real authorization code.
  const origin = await getRequestOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }

  return { error: "Sign-in did not return a redirect URL." };
}
