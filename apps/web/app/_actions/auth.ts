"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "../../lib/supabase/server";
import type { OAuthProviderId } from "../_lib/oauth-providers";
import { isOAuthProviderEnabled } from "../_lib/oauth-providers";
import { safeNextPath } from "../_lib/safe-next-path";
import { checkRateLimit, getClientIp } from "../_lib/rate-limit";

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

  const rateLimit = checkRateLimit(
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

  const rateLimit = checkRateLimit(
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
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

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
  const rateLimit = checkRateLimit(
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

  const origin = (await headers()).get("origin") ?? "";
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
