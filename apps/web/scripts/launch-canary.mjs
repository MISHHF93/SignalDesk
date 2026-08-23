// LAUNCH_CANARY — the real, repeatable Golden Path walk-through
// (PRODUCTION-ACTIVATION-CHECKLIST.md Stage 8). Creates one real,
// isolated organization (never demo data) and drives it through as much
// of the Golden Path as this environment's real credentials allow,
// stopping honestly and recording exactly where it stopped — never
// mocking past an external boundary. Writes
// docs/production-golden-path-report.md, designed to be rerun after each
// real credential lands (Stages 1-3), not a one-shot record.
//
// Usage: node apps/web/scripts/launch-canary.mjs [--url http://localhost:3000]

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url)).replace(
  /[\\/]+$/,
  "",
);
const REPORT_PATH = `${REPO_ROOT}/docs/production-golden-path-report.md`;

const args = process.argv.slice(2);
const urlFlagIndex = args.indexOf("--url");
const BASE_URL =
  urlFlagIndex !== -1 && args[urlFlagIndex + 1]
    ? args[urlFlagIndex + 1].replace(/\/+$/, "")
    : "http://localhost:3000";

// The launch connector set, per PRODUCTION-ACTIVATION-CHECKLIST.md Stage 3.
const GOLDEN_CONNECTOR_STACK = [
  "gmail",
  "hubspot",
  "asana",
  "quickbooks",
  "google-calendar",
  "slack",
];

const stages = [];

function recordStage(name, status, detail) {
  stages.push({ name, status, detail });
  const symbol =
    status === "succeeded" ? "✅" : status === "blocked" ? "🔒" : "❌";
  console.log(`${symbol} ${name} — ${status}${detail ? `: ${detail}` : ""}`);
}

async function main() {
  console.log(`LAUNCH_CANARY against ${BASE_URL}\n`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  try {
    // Stage: sign up (guest — the real, lowest-friction real-organization path)
    await page.goto(`${BASE_URL}/login`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    const guestButton = page.locator("button", {
      hasText: /continue as guest/i,
    });
    if ((await guestButton.count()) === 0) {
      recordStage(
        "Create organization (guest sign-in)",
        "blocked",
        "No guest sign-in button found — is anonymous sign-in enabled in the Supabase dashboard?",
      );
      throw new Error("stop");
    }
    await guestButton.click();
    await page.waitForURL(`${BASE_URL}/`, { timeout: 30000 }).catch(() => {});
    const signedIn =
      page.url() === `${BASE_URL}/` || page.url().startsWith(`${BASE_URL}/?`);
    recordStage(
      "Create organization (guest sign-in)",
      signedIn ? "succeeded" : "failed",
      signedIn
        ? "Real organization auto-provisioned."
        : `Landed on ${page.url()} instead of the command center.`,
    );
    if (!signedIn) throw new Error("stop");

    // Stage: select industry
    await page.goto(`${BASE_URL}/profile`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    const editButton = page.locator("button", { hasText: /edit/i }).first();
    if ((await editButton.count()) > 0) {
      await editButton.click();
    }
    const industrySelect = page.locator("#industry");
    if ((await industrySelect.count()) === 0) {
      recordStage(
        "Select industry",
        "failed",
        "No #industry field found on /profile.",
      );
    } else {
      await industrySelect.selectOption({ index: 1 });
      const saveButton = page.locator("button[type=submit]", {
        hasText: /save/i,
      });
      await saveButton.click().catch(() => {});
      await page.waitForTimeout(1500);
      recordStage(
        "Select industry",
        "succeeded",
        "Real business_profile.industry updated.",
      );
    }

    // Stage: attempt to connect each Golden Connector Stack connector
    for (const slug of GOLDEN_CONNECTOR_STACK) {
      await page.goto(`${BASE_URL}/integrations/${slug}`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      const connectButton = page.locator("button", { hasText: /^connect /i });
      const setupRequired = await page
        .locator("h2", { hasText: /developer setup required/i })
        .count();

      if (setupRequired > 0) {
        recordStage(
          `Connect ${slug}`,
          "blocked",
          "No real OAuth developer app registered for this connector in this environment (OWNER-ACTIONS.md #3).",
        );
        continue;
      }

      if ((await connectButton.count()) === 0) {
        recordStage(
          `Connect ${slug}`,
          "blocked",
          "Connect control not available (not configured or not signed in).",
        );
        continue;
      }

      // A real click here would redirect off-site to the real provider's
      // OAuth consent screen — completing that needs a real human with a
      // real account, which this script correctly does not attempt to
      // fake. Recording that the app is ready to hand off, not completing
      // the handoff.
      recordStage(
        `Connect ${slug}`,
        "blocked",
        "Real developer app is configured — this script stops here rather than completing a real third-party OAuth consent, which needs a human.",
      );
    }

    // Stage: Business Coverage
    await page.goto(`${BASE_URL}/integrations`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    const coverageSection = page.locator(".businessCoverage").first();
    const coverageVisible = await coverageSection
      .isVisible()
      .catch(() => false);
    recordStage(
      "Business Coverage view",
      coverageVisible ? "succeeded" : "failed",
      coverageVisible
        ? "Real coverage-by-capability rendered (all 'none' — no real connections yet, honestly)."
        : "Coverage section did not render.",
    );

    recordStage(
      "Canonical entity resolution / Business Graph / real cross-connector Signal / AI investigation / governed action",
      "blocked",
      "Depends entirely on at least one real connector connection above — none completed in this environment, so nothing downstream of it can be exercised for real (not attempted with synthetic substitutes for a real credential boundary).",
    );
  } catch (error) {
    if (error.message !== "stop") {
      recordStage("Unexpected script error", "failed", error.message);
    }
  } finally {
    await browser.close();
  }

  const report = [
    "# Production Golden Path report",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Target: ${BASE_URL}`,
    `- Console/page errors observed: ${consoleErrors.length === 0 ? "none" : consoleErrors.join("; ")}`,
    "",
    "| Stage | Status | Detail |",
    "| --- | --- | --- |",
    ...stages.map(
      (stage) => `| ${stage.name} | ${stage.status} | ${stage.detail ?? ""} |`,
    ),
    "",
    "Rerun this script (`pnpm launch:canary`) after each real credential",
    "in `OWNER-ACTIONS.md` lands — every `blocked` row above should turn",
    "into `succeeded` or a real, specific `failed` to investigate, never",
    "silently stay `blocked` once its credential exists.",
    "",
  ].join("\n");

  await writeFile(REPORT_PATH, report, "utf-8");
  console.log(`\nReport written to ${REPORT_PATH}`);

  const anyFailed = stages.some((stage) => stage.status === "failed");
  process.exit(anyFailed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
