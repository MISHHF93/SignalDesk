import { defineConfig, devices } from "@playwright/test";

/**
 * Drives the real running app (see the repo-level `run` skill) rather than
 * importing components in isolation — the Drawer's focus-trap/restoration
 * behavior in `_components/drawer.tsx` depends on real DOM focus order and
 * real keyboard events, which a unit test can't exercise honestly.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
