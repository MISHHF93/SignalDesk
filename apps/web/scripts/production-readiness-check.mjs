// Production smoke test + lightweight load test. Two modes:
//   1. Local (default): spawns a real `next start` (production mode, not
//      `next dev`) instance and tests that — requires `pnpm build` to have
//      already produced `.next/`. Verifies the build, not a live deploy.
//   2. Remote (`--url`): tests an already-deployed URL directly, no local
//      server spawned — the actual "verify the live deployment" case
//      named in docs/deployment-runbook.md, run right after a real Vercel
//      deploy. Skips the load-test pass by default against a remote URL
//      (a 10-connection/10s burst against someone else's production
//      traffic is a real-world load test, not a smoke test — pass
//      `--load` to opt in deliberately).
//
// Usage:
//   node scripts/production-readiness-check.mjs [--port 3100]
//   node scripts/production-readiness-check.mjs --url https://your-deploy.vercel.app [--load]

import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import autocannon from "autocannon";

// Resolved via fileURLToPath, not raw `.pathname` — this repo's own path
// ("Business dashboard") contains a space, which `.pathname` would leave
// as a literal `%20` that doesn't exist on disk.
const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

const args = process.argv.slice(2);
const portFlagIndex = args.indexOf("--port");
const PORT =
  portFlagIndex !== -1 && args[portFlagIndex + 1]
    ? Number(args[portFlagIndex + 1])
    : 3100;
const urlFlagIndex = args.indexOf("--url");
const REMOTE_URL =
  urlFlagIndex !== -1 && args[urlFlagIndex + 1] ? args[urlFlagIndex + 1] : null;
const RUN_LOAD_TEST = REMOTE_URL === null || args.includes("--load");
const BASE_URL = REMOTE_URL
  ? REMOTE_URL.replace(/\/+$/, "")
  : `http://localhost:${PORT}`;
const READY_TIMEOUT_MS = 30_000;

// [path, expected HTTP status]. Ground truth taken from the same routes'
// real behavior against the dev server before writing this list — `/` is
// the only one that redirects signed-out visitors (the proxy intercepts
// before any layout renders); every other page route renders its own
// signed-out-safe content with a real 200. `/api/business/snapshot` is
// the one API route and correctly 401s with no session.
const SMOKE_ROUTES = [
  ["/", 307],
  ["/login", 200],
  ["/signup", 200],
  ["/pricing", 200],
  ["/integrations", 200],
  ["/integrations/slack", 200],
  ["/profile", 200],
  ["/billing", 200],
  ["/briefs", 200],
  ["/legal/terms", 200],
  ["/legal/privacy", 200],
  ["/support", 200],
  ["/api/business/snapshot", 401],
  ["/api/health", 200],
  ["/api/cron/morning-brief", 401],
];

// Routes worth a load-test pass: both render a real page for a
// signed-out visitor without needing a database round trip beyond what
// the connection pool already has warm.
const LOAD_TEST_ROUTES = ["/pricing", "/integrations"];

function startProductionServer() {
  // `PORT` (not a forwarded `-p` CLI flag) — pnpm's `--` argument
  // forwarding doesn't survive `shell: true` + array args cleanly on
  // Windows, and Next.js already reads `PORT` directly for `next start`.
  // `shell` only needs to be `true` on Windows, where `pnpm` itself is a
  // `.cmd` shim `spawn` can't resolve directly — same platform split
  // `killServerTree` below already uses. All args here are fixed literals,
  // never external input, but there's no reason to carry Node's own
  // shell-args deprecation warning on platforms that don't need it.
  const child = spawn("pnpm", ["--filter", "@signaldesk/web", "start"], {
    cwd: REPO_ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  return {
    child,
    getOutput: () => output,
  };
}

/**
 * `child.kill()` alone only signals the shell wrapper `shell: true`
 * spawned — on Windows it does not reach the actual `next start`
 * grandchild, which is left orphaned and still bound to `PORT` (confirmed
 * by hand: killing only the wrapper left the real server listening).
 * `taskkill /t` kills the whole process tree; `SIGTERM` is enough
 * everywhere else.
 */
function killServerTree(child) {
  if (process.platform === "win32" && child.pid) {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
      });
    } catch {
      // Already exited — nothing to clean up.
    }
  } else {
    child.kill();
  }
}

async function waitForReady(deadline) {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/login`, {
        redirect: "manual",
      });
      if (response.status === 200) {
        return true;
      }
    } catch {
      // Server not accepting connections yet — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function runSmokeChecks() {
  const results = [];
  for (const [path, expectedStatus] of SMOKE_ROUTES) {
    const startedAt = performance.now();
    let status = null;
    let error = null;
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        redirect: "manual",
      });
      status = response.status;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    const durationMs = performance.now() - startedAt;
    results.push({
      path,
      expectedStatus,
      status,
      error,
      durationMs,
      pass: status === expectedStatus,
    });
  }
  return results;
}

async function runLoadTest(path) {
  return autocannon({
    url: `${BASE_URL}${path}`,
    connections: 10,
    duration: 10,
  });
}

function printSmokeResults(results) {
  console.log("\n=== Production smoke test (next start, real routes) ===");
  for (const result of results) {
    const label = result.pass ? "PASS" : "FAIL";
    const statusText = result.error ? `error: ${result.error}` : result.status;
    console.log(
      `[${label}] ${result.path} -> ${statusText} (expected ${result.expectedStatus}), ${result.durationMs.toFixed(0)}ms`,
    );
  }
}

function printLoadResult(path, stats) {
  console.log(`\n=== Load test: ${path} (10 connections, 10s) ===`);
  console.log(`requests/sec:  avg ${stats.requests.average.toFixed(1)}`);
  console.log(
    `latency (ms):  avg ${stats.latency.average.toFixed(1)}  p99 ${stats.latency.p99.toFixed(1)}`,
  );
  console.log(
    `throughput:    ${(stats.throughput.average / 1024).toFixed(1)} KB/s`,
  );
  console.log(
    `2xx: ${stats["2xx"]}  non-2xx/errors: ${stats.non2xx + stats.errors}`,
  );
}

async function main() {
  let cleanup = () => {};

  if (REMOTE_URL) {
    console.log(`Testing already-deployed URL: ${BASE_URL}`);
    const reachable = await waitForReady(Date.now() + READY_TIMEOUT_MS);
    if (!reachable) {
      console.error(
        `${BASE_URL}/login did not respond within ${READY_TIMEOUT_MS}ms.`,
      );
      process.exit(1);
    }
  } else {
    console.log(`Starting production server on port ${PORT}...`);
    const { child, getOutput } = startProductionServer();

    cleanup = () => {
      killServerTree(child);
    };
    process.on("exit", cleanup);
    process.on("SIGINT", () => {
      cleanup();
      process.exit(130);
    });

    const ready = await waitForReady(Date.now() + READY_TIMEOUT_MS);
    if (!ready) {
      console.error(
        `Production server did not become ready within ${READY_TIMEOUT_MS}ms.`,
      );
      console.error("Server output so far:\n" + getOutput());
      cleanup();
      process.exit(1);
    }
    console.log("Production server is ready.");
  }

  const smokeResults = await runSmokeChecks();
  printSmokeResults(smokeResults);
  const smokeFailed = smokeResults.some((result) => !result.pass);

  if (RUN_LOAD_TEST) {
    for (const path of LOAD_TEST_ROUTES) {
      const stats = await runLoadTest(path);
      printLoadResult(path, stats);
    }
  } else {
    console.log(
      "\nSkipping load test against a remote deployment (pass --load to run it deliberately).",
    );
  }

  cleanup();

  if (smokeFailed) {
    console.error("\nProduction smoke test FAILED — see routes above.");
    process.exit(1);
  }

  console.log("\nProduction smoke test and load test complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
