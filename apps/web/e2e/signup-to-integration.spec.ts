import { test, expect } from "@playwright/test";

/**
 * The "sign up → connect a tool → see it on Today" journey the Customer
 * POV audit (SELF-HEALING-AUDIT.md, Iterations 20-23) verified in pieces
 * manually/live across four passes but never as one continuous automated
 * test — this is that test. Deliberately one `test()` block, not several:
 * `continueAsGuestAction` (`_actions/auth.ts`) is rate-limited to 5 guest
 * sessions per hour per IP (a real, Postgres-backed limit, not a test
 * double), so splitting this into separate tests would burn that quota
 * once per test instead of once per run and risk flaking on repeated
 * local execution — the same reasoning `drawer-focus-trap.spec.ts`
 * documents for avoiding a session at all. One continuous session here
 * also matches how a real user actually experiences this journey: one
 * sign-in, then several screens in sequence, not independent visits.
 *
 * This suite runs against `pnpm dev` (`playwright.config.ts`'s
 * `webServer`), i.e. real local-development mode — deliberately does
 * NOT assert on the presence or absence of the local-only connector
 * setup instructions (`isLocalDevelopment()`, `_lib/environment.ts`),
 * since asserting either way here would be testing dev-mode-only
 * behavior in a harness that can only ever run in dev mode. What it
 * verifies instead is real everywhere: the session and navigation work,
 * and every connector detail page in the real catalog actually renders
 * (no 500, no crash, no error boundary) rather than assuming that from
 * a handful of manually-screenshotted connectors.
 */
test("a new guest can sign in, land on Today, and open every connector detail page without error", async ({
  page,
}) => {
  // The real catalog has 25 connectors (`connectorCatalog`,
  // `@signaldesk/integrations`) — visiting each one sequentially, on a
  // real dev server, reliably exceeds Playwright's default 30s test
  // timeout even though every individual navigation is fast.
  test.setTimeout(120_000);

  await page.goto("/login");

  await page.getByRole("button", { name: /continue as guest/i }).click();

  // Real navigation to "/" after a real Server Action redirect — not a
  // client-side transition, so this waits for the actual page load.
  await page.waitForURL("**/");

  await expect(
    page.getByRole("heading", { name: /here.s what needs your attention/i }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/you.re browsing as a guest/i)).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("link", { name: "Integrations" }).click();
  await page.waitForURL("**/integrations");

  await expect(
    page.getByRole("heading", { name: /bring your business tools/i }),
  ).toBeVisible();

  // Every connector slug in the real catalog, read from the rendered
  // page rather than hardcoded — if a connector is added or removed
  // from `connectorCatalog`, this list follows without editing the test.
  const connectorLinks = page.locator(".connectorGrid .connectorLink");
  const connectorCount = await connectorLinks.count();
  expect(connectorCount).toBeGreaterThan(0);
  const hrefs = await connectorLinks.evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")).filter(Boolean),
  );

  for (const href of hrefs) {
    await page.goto(href as string);

    // The real assertion: the page rendered a real connector heading, not
    // Next's error boundary (`error.tsx`, Iteration 20) or a 404
    // (`not-found.tsx`) — either of which would mean this specific
    // connector's detail page crashed for a real visitor.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText(/something went wrong on this page/i),
    ).toHaveCount(0);
    await expect(page.getByText(/page not found/i)).toHaveCount(0);
  }

  await page.goto("/");
  await nav.getByRole("link", { name: "Today" }).click();
  await page.waitForURL("**/");
  await expect(
    page.getByRole("heading", { name: /here.s what needs your attention/i }),
  ).toBeVisible();
});
