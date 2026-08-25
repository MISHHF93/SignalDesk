#!/usr/bin/env node
// Visual audit driver — see SKILL.md in this directory for how/when to use
// this. Signs in as a fresh guest, then screenshots every configured route
// at every configured viewport. Screenshots are evidence for a human/Claude
// to actually look at (Read tool) — this script does not judge them.

import { chromium } from "playwright";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const BASE_URL = process.env.AUDIT_BASE_URL || "http://localhost:3100";
// Resolved to an absolute path (and always printed below) specifically so
// a drifted shell cwd is caught immediately rather than silently writing
// to — and later reading screenshots back from — the wrong directory. This
// bit a real run: a stray `packages/intelligence/.visual-audit/` appeared
// because a later invocation's cwd had silently changed, and a stale
// `apps/web/.visual-audit/desktop-today.png` kept getting re-read as if it
// were freshly re-verified. Always check this printed path matches where
// you're about to Read from.
const OUT_DIR = resolve(process.env.AUDIT_OUT_DIR || ".visual-audit");
// Set to sign in as a fresh guest, save the session, print nothing else,
// and exit — without walking any routes. Use this before seeding test data
// (see SKILL.md step 2), so the seed targets the exact organization this
// script will walk, then run again without this flag to do the real walk;
// the saved session is reused automatically since it's newer than "just
// created," not re-created.
const SIGNIN_ONLY = process.env.AUDIT_SIGNIN_ONLY === "1";

const VIEWPORT_PRESETS = {
  // 1280x900 desktop, 834x1112 tablet (iPad portrait), 390x844 mobile
  // (iPhone 12/13/14) — chosen so each sits solidly on one side of every
  // real breakpoint this app's CSS uses (1100px/800px/720px/600px), not
  // exactly on a boundary where a screenshot could accidentally miss a
  // real layout shift a real device would trigger.
  desktop: { width: 1280, height: 900 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
};

const viewportNames = (process.env.AUDIT_VIEWPORTS || "desktop,tablet,mobile")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

for (const name of viewportNames) {
  if (!VIEWPORT_PRESETS[name]) {
    console.error(
      `Unknown viewport "${name}". Known: ${Object.keys(VIEWPORT_PRESETS).join(", ")}`,
    );
    process.exit(1);
  }
}

// Default route list — the app's real primary-nav destinations plus the
// two intercepting-route drawers and the unauthenticated entry points.
// `auth: true` routes are captured using the saved guest session;
// `auth: false` routes are also captured in the signed-out state, since
// SignalDesk's real behavior differs there (e.g. /integrations and
// /pricing are both real without an account).
const DEFAULT_ROUTES = [
  { path: "/", name: "today", auth: true },
  { path: "/integrations", name: "integrations", auth: true },
  { path: "/integrations", name: "integrations-signed-out", auth: false },
  {
    path: "/integrations/gmail",
    name: "integrations-gmail-drawer",
    auth: true,
  },
  { path: "/pricing", name: "pricing", auth: false },
  { path: "/profile", name: "profile", auth: true },
  { path: "/billing", name: "billing", auth: true },
  { path: "/trust", name: "trust", auth: true },
  { path: "/agents", name: "agents", auth: true },
  { path: "/briefs", name: "briefs", auth: true },
  { path: "/support", name: "support", auth: false },
  { path: "/legal/terms", name: "legal-terms", auth: false },
  { path: "/legal/privacy", name: "legal-privacy", auth: false },
  { path: "/login", name: "login", auth: false },
  { path: "/signup", name: "signup", auth: false },
];

const routes = process.env.AUDIT_ROUTES
  ? process.env.AUDIT_ROUTES.split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      // Git-Bash/MSYS on Windows silently rewrites ANY shell argument that
      // looks like an absolute unix path (leading "/") into a Windows path
      // (e.g. "/trust" becomes "C:/Program Files/Git/trust") before Node
      // ever sees it. Accepting a bare word without the leading slash
      // ("trust", "today") sidesteps this entirely, since MSYS only
      // rewrites arguments that already start with "/" — prepend it back
      // here rather than requiring every caller to remember the quirk.
      .map((p) => (["today", "home", "root"].includes(p) ? "/" : p))
      .map((p) => (p.startsWith("/") ? p : `/${p}`))
      .flatMap((p) => {
        const match = DEFAULT_ROUTES.filter((r) => r.path === p);
        return match.length > 0
          ? match
          : [
              {
                path: p,
                name: p.replace(/^\/|\/$/g, "").replace(/\//g, "-") || "root",
                auth: true,
              },
            ];
      })
  : DEFAULT_ROUTES;

mkdirSync(OUT_DIR, { recursive: true });

const consoleErrorsByRoute = {};

async function signInAsGuest(browser) {
  const statePath = join(OUT_DIR, ".guest-state.json");

  // Reuse an already-saved guest session rather than creating a new
  // organization on every run — lets step 2 of SKILL.md (seed data, then
  // walk) target one real, known organization instead of a fresh empty one
  // each invocation. Delete the file yourself for a genuinely fresh guest.
  if (existsSync(statePath) && !SIGNIN_ONLY) {
    console.log(`Reusing saved guest session (${statePath}).`);
    return statePath;
  }

  const page = await browser.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  const guestButton = page.getByRole("button", { name: /continue as guest/i });
  await guestButton.click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 20000,
  });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.context().storageState({ path: statePath });
  await page.close();
  return statePath;
}

async function screenshotRoute(browser, storageStatePath, route, viewportName) {
  const context = await browser.newContext({
    storageState: route.auth ? storageStatePath : undefined,
    viewport: VIEWPORT_PRESETS[viewportName],
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));

  const fileBase = `${viewportName}-${route.name}`;
  try {
    await page.goto(`${BASE_URL}${route.path}`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(800);
    // The Next.js dev-mode indicator (fixed-position "N" button, real dev
    // server chrome that never appears in production) sits wherever the
    // viewport happened to be on load and, in a full-page screenshot, can
    // land mid-content and obscure real text — found overlapping a
    // connector's "Connected since" row on /trust. Hidden here, not fixed
    // in the app: this is dev-only tooling, not a real UI element.
    await page
      .addStyleTag({
        content:
          "[data-nextjs-dev-tools-button], #__next-build-watcher, nextjs-portal { display: none !important; }",
      })
      .catch(() => {});
    await page.screenshot({
      path: join(OUT_DIR, `${fileBase}.png`),
      fullPage: true,
    });
    console.log(`✓ ${fileBase}.png`);
  } catch (err) {
    console.error(`✗ ${fileBase}: ${err.message}`);
  }

  if (errors.length > 0) {
    consoleErrorsByRoute[fileBase] = errors;
  }

  await context.close();
}

const browser = await chromium.launch();
console.log(`Base URL: ${BASE_URL}`);
console.log(`Output: ${OUT_DIR}`);

if (SIGNIN_ONLY) {
  const statePath = await signInAsGuest(browser);
  console.log(`Saved fresh guest session to ${statePath}.`);
  console.log(
    "Now resolve its organization_id (newest row in `organizations`) and seed data for it — see SKILL.md step 2 — then re-run without AUDIT_SIGNIN_ONLY.",
  );
  await browser.close();
  process.exit(0);
}

console.log(`Viewports: ${viewportNames.join(", ")}`);
console.log(`Routes: ${routes.map((r) => r.path).join(", ")}\n`);

const needsAuth = routes.some((r) => r.auth);
const storageStatePath = needsAuth ? await signInAsGuest(browser) : null;
if (needsAuth) console.log("Signed in as guest.\n");

for (const viewportName of viewportNames) {
  for (const route of routes) {
    await screenshotRoute(browser, storageStatePath, route, viewportName);
  }
}

await browser.close();

if (Object.keys(consoleErrorsByRoute).length > 0) {
  console.log("\n⚠ Console/page errors detected:");
  console.log(JSON.stringify(consoleErrorsByRoute, null, 2));
} else {
  console.log("\nNo console or page errors on any captured route.");
}
