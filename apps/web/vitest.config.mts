import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `e2e/` holds real Playwright specs (see playwright.config.ts) — they
    // import `test`/`expect` from `@playwright/test`, not vitest, and
    // vitest's own default include glob (`**/*.spec.ts`) would otherwise
    // pick them up and fail with "Playwright Test did not expect test() to
    // be called here."
    exclude: ["**/node_modules/**", "e2e/**"],
  },
});
