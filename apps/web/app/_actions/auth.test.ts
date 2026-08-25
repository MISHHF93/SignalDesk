import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/rate-limit");
vi.mock("../_lib/oauth-providers");
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("next/navigation");
vi.mock("../../lib/supabase/server");
vi.mock("@signaldesk/persistence");

import { redirect } from "next/navigation";

import { createClient } from "../../lib/supabase/server";
import { isOAuthProviderEnabled } from "../_lib/oauth-providers";
import { checkRateLimit, getClientIp } from "../_lib/rate-limit";
import {
  continueAsGuestAction,
  requestPasswordResetAction,
  signInAction,
  signInWithOAuthAction,
  signOutAction,
  signUpAction,
  updatePasswordAction,
} from "./auth";

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetClientIp = vi.mocked(getClientIp);
const mockedIsOAuthProviderEnabled = vi.mocked(isOAuthProviderEnabled);
const mockedCreateClient = vi.mocked(createClient);
const mockedRedirect = vi.mocked(redirect);

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

function mockSupabaseAuth(overrides: Record<string, unknown> = {}) {
  const auth = {
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    signInAnonymously: vi.fn().mockResolvedValue({ error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({
      data: { url: "https://provider.example/authorize" },
      error: null,
    }),
    ...overrides,
  };
  mockedCreateClient.mockResolvedValue({ auth } as unknown as Awaited<
    ReturnType<typeof createClient>
  >);
  return auth;
}

/**
 * Real behavioral coverage for this app's auth Server Actions — no
 * prior test file existed for any of them. The two properties worth
 * verifying beyond generic input validation: `requestPasswordResetAction`
 * must return the identical generic message regardless of what
 * Supabase's own call resolves to (an account-enumeration side channel
 * this action must never reintroduce), and every action that redirects
 * to a caller-supplied `next` path must route it through the real
 * `safeNextPath` — not a mock — so an open-redirect payload is actually
 * exercised and neutralized, not merely assumed sanitized.
 */
describe("auth actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetClientIp.mockResolvedValue("203.0.113.1");
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedRedirect.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
    mockSupabaseAuth();
  });

  describe("signInAction", () => {
    it("rejects a missing email or password without checking the rate limit", async () => {
      const result = await signInAction(
        { error: null },
        formData({ password: "hunter2" }),
      );

      expect(result).toEqual({ error: "Enter your email and password." });
      expect(mockedCheckRateLimit).not.toHaveBeenCalled();
    });

    it("refuses at the rate limit", async () => {
      mockedCheckRateLimit.mockResolvedValue({
        allowed: false,
        retryAfterSeconds: 45,
      });

      const result = await signInAction(
        { error: null },
        formData({ email: "a@example.com", password: "hunter2" }),
      );

      expect(result).toEqual({
        error: "Too many sign-in attempts. Try again in 45 seconds.",
      });
    });

    it("surfaces Supabase's own error message as-is", async () => {
      mockSupabaseAuth({
        signInWithPassword: vi.fn().mockResolvedValue({
          error: { message: "Invalid login credentials" },
        }),
      });

      const result = await signInAction(
        { error: null },
        formData({ email: "a@example.com", password: "wrong" }),
      );

      expect(result).toEqual({ error: "Invalid login credentials" });
    });

    it("redirects to a safe next path on success", async () => {
      await expect(
        signInAction(
          { error: null },
          formData({
            email: "a@example.com",
            password: "hunter2",
            next: "/billing",
          }),
        ),
      ).rejects.toThrow("NEXT_REDIRECT:/billing");
    });

    it("neutralizes an open-redirect payload in next, routing through the real safeNextPath", async () => {
      await expect(
        signInAction(
          { error: null },
          formData({
            email: "a@example.com",
            password: "hunter2",
            next: "//evil.example",
          }),
        ),
      ).rejects.toThrow("NEXT_REDIRECT:/");
    });
  });

  describe("signUpAction", () => {
    it("rejects a short password", async () => {
      const result = await signUpAction(
        { error: null },
        formData({ email: "a@example.com", password: "short" }),
      );

      expect(result).toEqual({
        error: "Your password must be at least 8 characters.",
      });
    });

    it("passes a real invite token through to Supabase's user metadata", async () => {
      const auth = mockSupabaseAuth({
        signUp: vi
          .fn()
          .mockResolvedValue({ data: { session: null }, error: null }),
      });

      await signUpAction(
        { error: null },
        formData({
          email: "a@example.com",
          password: "longenough1",
          inviteToken: "invite-abc",
        }),
      );

      expect(auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: { data: { invite_token: "invite-abc" } },
        }),
      );
    });

    it("returns a check-your-email message with no redirect when no session comes back yet", async () => {
      mockSupabaseAuth({
        signUp: vi
          .fn()
          .mockResolvedValue({ data: { session: null }, error: null }),
      });

      const result = await signUpAction(
        { error: null },
        formData({ email: "a@example.com", password: "longenough1" }),
      );

      expect(result).toEqual({
        error: null,
        message: "Check your email to confirm your account, then sign in.",
      });
      expect(mockedRedirect).not.toHaveBeenCalled();
    });

    it("redirects immediately when Supabase returns a session (confirmed-email project)", async () => {
      await expect(
        signUpAction(
          { error: null },
          formData({ email: "a@example.com", password: "longenough1" }),
        ),
      ).rejects.toThrow("NEXT_REDIRECT:/");
    });
  });

  describe("signOutAction", () => {
    it("signs out and redirects to /login", async () => {
      await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT:/login");
    });
  });

  describe("requestPasswordResetAction", () => {
    it("rejects a missing email without checking the rate limit", async () => {
      const result = await requestPasswordResetAction(
        { error: null },
        formData({}),
      );

      expect(result).toEqual({ error: "Enter your email." });
      expect(mockedCheckRateLimit).not.toHaveBeenCalled();
    });

    it("refuses at the rate limit", async () => {
      mockedCheckRateLimit.mockResolvedValue({
        allowed: false,
        retryAfterSeconds: 120,
      });

      const result = await requestPasswordResetAction(
        { error: null },
        formData({ email: "a@example.com" }),
      );

      expect(result).toEqual({
        error: "Too many reset attempts. Try again in 2 minutes.",
      });
    });

    it("returns the identical generic message for a real account", async () => {
      const auth = mockSupabaseAuth({
        resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await requestPasswordResetAction(
        { error: null },
        formData({ email: "real-user@example.com" }),
      );

      expect(auth.resetPasswordForEmail).toHaveBeenCalled();
      expect(result).toEqual({
        error: null,
        message:
          "If that email has an account, a password reset link is on its way.",
      });
    });

    it("returns the exact same generic message even when Supabase's own call reports an error — this action must never disclose account existence", async () => {
      mockSupabaseAuth({
        resetPasswordForEmail: vi
          .fn()
          .mockResolvedValue({ error: { message: "User not found" } }),
      });

      const result = await requestPasswordResetAction(
        { error: null },
        formData({ email: "nonexistent@example.com" }),
      );

      expect(result).toEqual({
        error: null,
        message:
          "If that email has an account, a password reset link is on its way.",
      });
    });
  });

  describe("updatePasswordAction", () => {
    it("rejects a short new password", async () => {
      const result = await updatePasswordAction(
        { error: null },
        formData({ password: "short" }),
      );

      expect(result).toEqual({
        error: "Your new password must be at least 8 characters.",
      });
    });

    it("surfaces a real Supabase error (e.g. no active recovery session) as-is", async () => {
      mockSupabaseAuth({
        updateUser: vi
          .fn()
          .mockResolvedValue({ error: { message: "Auth session missing" } }),
      });

      const result = await updatePasswordAction(
        { error: null },
        formData({ password: "longenough1" }),
      );

      expect(result).toEqual({ error: "Auth session missing" });
    });

    it("redirects to /login?reset=1 on success", async () => {
      await expect(
        updatePasswordAction(
          { error: null },
          formData({ password: "longenough1" }),
        ),
      ).rejects.toThrow("NEXT_REDIRECT:/login?reset=1");
    });
  });

  describe("continueAsGuestAction", () => {
    it("refuses at the rate limit", async () => {
      mockedCheckRateLimit.mockResolvedValue({
        allowed: false,
        retryAfterSeconds: 60,
      });

      const result = await continueAsGuestAction({ error: null }, formData({}));

      expect(result).toEqual({
        error:
          "Too many guest sessions from this connection. Try again in 1 minutes.",
      });
    });

    it("redirects to a safe next path on success", async () => {
      await expect(
        continueAsGuestAction({ error: null }, formData({ next: "/pricing" })),
      ).rejects.toThrow("NEXT_REDIRECT:/pricing");
    });
  });

  describe("signInWithOAuthAction", () => {
    it("refuses a provider that isn't enabled without ever calling Supabase", async () => {
      mockedIsOAuthProviderEnabled.mockReturnValue(false);

      const result = await signInWithOAuthAction(
        { error: null },
        formData({ provider: "google" }),
      );

      expect(result).toEqual({
        error: "This sign-in method is not yet connected.",
      });
      expect(mockedCreateClient).not.toHaveBeenCalled();
    });

    it("returns an honest error when Supabase gives no redirect URL", async () => {
      mockedIsOAuthProviderEnabled.mockReturnValue(true);
      mockSupabaseAuth({
        signInWithOAuth: vi
          .fn()
          .mockResolvedValue({ data: { url: null }, error: null }),
      });

      const result = await signInWithOAuthAction(
        { error: null },
        formData({ provider: "google" }),
      );

      expect(result).toEqual({
        error: "Sign-in did not return a redirect URL.",
      });
    });

    it("redirects to the provider's real authorization URL on success", async () => {
      mockedIsOAuthProviderEnabled.mockReturnValue(true);

      await expect(
        signInWithOAuthAction(
          { error: null },
          formData({ provider: "google" }),
        ),
      ).rejects.toThrow("NEXT_REDIRECT:https://provider.example/authorize");
    });
  });
});
