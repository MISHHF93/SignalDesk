import { beforeEach, describe, expect, it, vi } from "vitest";

// A real, in-memory stand-in for Next's cookie jar — supports exactly the
// get/set/delete surface these functions use, so the test exercises the
// real single-use consume-then-clear behavior rather than mocking it away.
const store = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    set: (name: string, value: string) => {
      store.set(name, value);
    },
    get: (name: string) => {
      const value = store.get(name);
      return value === undefined ? undefined : { value };
    },
    delete: (name: string) => {
      store.delete(name);
    },
  }),
}));

import {
  consumeOAuthState,
  consumeOAuthSubdomain,
  consumePkceVerifier,
  issueOAuthState,
  issueOAuthSubdomain,
  issuePkceVerifier,
} from "./oauth-state";

describe("oauth-state", () => {
  beforeEach(() => {
    store.clear();
  });

  describe("issueOAuthState / consumeOAuthState", () => {
    it("accepts the exact nonce it issued", async () => {
      const nonce = await issueOAuthState("hubspot");

      await expect(consumeOAuthState("hubspot", nonce)).resolves.toBe(true);
    });

    it("is single-use — a second consume of the same state fails", async () => {
      const nonce = await issueOAuthState("hubspot");
      await consumeOAuthState("hubspot", nonce);

      await expect(consumeOAuthState("hubspot", nonce)).resolves.toBe(false);
    });

    it("rejects a mismatched state", async () => {
      await issueOAuthState("hubspot");

      await expect(
        consumeOAuthState("hubspot", "attacker-guessed-value"),
      ).resolves.toBe(false);
    });

    it("rejects when no state was ever issued", async () => {
      await expect(consumeOAuthState("hubspot", "anything")).resolves.toBe(
        false,
      );
    });

    it("rejects a null returned state", async () => {
      await issueOAuthState("hubspot");

      await expect(consumeOAuthState("hubspot", null)).resolves.toBe(false);
    });

    it("scopes the nonce to its own provider — another provider's state doesn't validate it", async () => {
      const nonce = await issueOAuthState("hubspot");

      await expect(consumeOAuthState("slack", nonce)).resolves.toBe(false);
    });
  });

  describe("issuePkceVerifier / consumePkceVerifier", () => {
    it("returns the exact verifier it stored, then clears it", async () => {
      await issuePkceVerifier("microsoft-outlook", "verifier-value");

      await expect(consumePkceVerifier("microsoft-outlook")).resolves.toBe(
        "verifier-value",
      );
      await expect(
        consumePkceVerifier("microsoft-outlook"),
      ).resolves.toBeNull();
    });

    it("returns null when nothing was stored", async () => {
      await expect(
        consumePkceVerifier("microsoft-outlook"),
      ).resolves.toBeNull();
    });
  });

  describe("issueOAuthSubdomain / consumeOAuthSubdomain", () => {
    it("returns the exact subdomain it stored, then clears it", async () => {
      await issueOAuthSubdomain("zendesk", "acme");

      await expect(consumeOAuthSubdomain("zendesk")).resolves.toBe("acme");
      await expect(consumeOAuthSubdomain("zendesk")).resolves.toBeNull();
    });

    it("returns null when nothing was stored", async () => {
      await expect(consumeOAuthSubdomain("zendesk")).resolves.toBeNull();
    });
  });
});
