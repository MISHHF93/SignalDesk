import { test, expect } from "@playwright/test";

/**
 * Codifies the WAI-ARIA dialog focus behavior `_components/drawer.tsx`
 * implements by hand (see its own doc comments): focus moves into the
 * drawer on open, Tab/Shift+Tab can never walk focus out into the
 * still-mounted page behind it, and closing returns focus to whatever
 * triggered the drawer. Iteration 11 confirmed this manually against the
 * `/integrations` connector detail drawer; this is the "actual automated
 * test" version of that same check.
 *
 * Drives the real app end to end (real navigation, real keyboard events)
 * rather than mounting the component in isolation, since the behavior
 * under test depends on the drawer rendering over a still-mounted page
 * via a Next.js intercepting route — a unit test can't reproduce that.
 * `/integrations` renders without requiring a session, so this doesn't
 * sign in at all — that also keeps it from tripping the real, Postgres-
 * backed guest-session rate limit (`_actions/auth.ts`) on repeated runs.
 */
test("traps Tab/Shift+Tab inside the drawer and restores focus to the trigger on close", async ({
  page,
}) => {
  await page.goto("/integrations");

  const trigger = page.getByRole("link", { name: /review setup/i }).first();
  await trigger.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  const closeButton = page.getByRole("button", { name: "Close" });
  await expect(closeButton).toBeFocused();

  // Walk forward with real Tab presses. Every stop must stay inside the
  // drawer panel — if the trap has a hole, focus lands on the page behind
  // it and this assertion catches it immediately. Forward Tabbing from the
  // first focusable element must eventually cycle back to Close, proving
  // the last-to-first wrap.
  const inPanel = page.locator(".drawerPanel:has(:focus)");
  let cycledBack = false;
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    await expect(inPanel).toHaveCount(1);
    if (await closeButton.evaluate((el) => el === document.activeElement)) {
      cycledBack = true;
      break;
    }
  }
  expect(cycledBack).toBe(true);

  // Shift+Tab from the first focusable element (Close) must wrap to the
  // last, not walk out of the panel.
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(inPanel).toHaveCount(1);
  const wrappedAwayFromClose = await closeButton.evaluate(
    (el) => el !== document.activeElement,
  );
  expect(wrappedAwayFromClose).toBe(true);

  // Escape closes the drawer and must return focus to the element that
  // opened it — not the document body, not wherever the DOM happened to
  // unmount from.
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
