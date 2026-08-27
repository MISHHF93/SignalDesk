import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_lib/rate-limit");
vi.mock("../../../lib/supabase/server");
vi.mock("@signaldesk/persistence");

import { createClient } from "../../../lib/supabase/server";
import { checkRateLimit, getClientIp } from "../../_lib/rate-limit";
import { GET } from "./route";

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetClientIp = vi.mocked(getClientIp);
const mockedCreateClient = vi.mocked(createClient);

function mockSupabaseAuth(overrides: Record<string, unknown> = {}) {
  const auth = {
    exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
  mockedCreateClient.mockResolvedValue({ auth } as unknown as Awaited<
    ReturnType<typeof createClient>
  >);
  return auth;
}

function requestWithParams(params: Record<string, string>): Request {
  const url = new URL("http://localhost/auth/callback");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url);
}

function locationOf(response: Response): string {
  return response.headers.get("location") ?? "";
}

/**
 * Real behavioral coverage for a route that had none, added alongside the
 * rate-limit fix itself: this had no bound on repeat calls at all, unlike
 * every direct sibling (`signInAction`/`signUpAction`/
 * `requestPasswordResetAction`, all 14 connector OAuth callbacks) despite
 * calling `exchangeCodeForSession`, a real network call to Supabase Auth
 * with a client-supplied `code`.
 */
describe("auth/callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetClientIp.mockResolvedValue("203.0.113.1");
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("exchanges a real code for a session and redirects to the safe next path", async () => {
    mockSupabaseAuth();

    const response = await GET(
      requestWithParams({ code: "real-code", next: "/dashboard" }),
    );

    expect(mockedCheckRateLimit).toHaveBeenCalledWith(
      undefined,
      "auth-callback:203.0.113.1",
      20,
      60 * 60 * 1000,
    );
    expect(locationOf(response)).toBe("http://localhost/dashboard");
  });

  it("redirects to the login page with an honest error when the exchange itself fails", async () => {
    mockSupabaseAuth({
      exchangeCodeForSession: vi
        .fn()
        .mockResolvedValue({ error: new Error("invalid code") }),
    });

    const response = await GET(requestWithParams({ code: "bad-code" }));

    expect(locationOf(response)).toBe("http://localhost/login?error=oauth");
  });

  it("redirects to the login page without ever exchanging anything when no code is present", async () => {
    const auth = mockSupabaseAuth();

    const response = await GET(requestWithParams({}));

    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(locationOf(response)).toBe("http://localhost/login?error=oauth");
  });

  it("refuses at the rate limit without ever exchanging anything", async () => {
    const auth = mockSupabaseAuth();
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 3600,
    });

    const response = await GET(requestWithParams({ code: "real-code" }));

    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(locationOf(response)).toBe("http://localhost/login?error=oauth");
  });
});
