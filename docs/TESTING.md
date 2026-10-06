# SignalDesk — Test Strategy & Acceptance Criteria

**Document Identifier**: `DOC-TEST-2026-V1`  
**Status**: `CANONICAL`  
**Owner**: Quality Engineering & Automated Testing  
**Last Verified Against Implementation**: 2026-10-05  

---

## 1. Test Pyramid & Methodology

SignalDesk employs a 5-tier testing pyramid designed to guarantee zero regressions across business calculations, UI state transitions, and third-party mutations:

```
                  ┌────────────────────────┐
                  │    Production Smoke    │
                  ├────────────────────────┤
                  │  E2E User Journeys     │
                  ├────────────────────────┤
                  │ Integration & Contract │
                  ├────────────────────────┤
                  │    Component & Hooks   │
                  ├────────────────────────┤
                  │   Unit & Logic Tests   │
                  └────────────────────────┘
```

---

## 2. Test Execution Commands

```bash
# 1. Type Checking & Static Linting (Enforces Zero TS Errors)
npm run lint

# 2. Production Asset Build Verification
npm run build

# 3. Unit & Integration Test Suites
npm test

# 4. Runtime Smoke Verification (All Critical Endpoints)
node -e "
const endpoints = ['/api/state', '/api/system/health', '/api/mcp/capabilities', '/api/connectors'];
Promise.all(endpoints.map(ep => fetch('http://localhost:3000' + ep).then(r => ({ ep, status: r.status }))))
  .then(console.log);
"
```

---

## 3. Behavioral Acceptance Criteria (Given / When / Then)

### Scenario 1: Instant Executive Launch (1-Click)
- **Given** an unauthenticated visitor navigates to the public portal (`https://signaldesk.ai/`),
- **When** the visitor clicks the primary golden button `"Launch Command Center"`,
- **Then** the application must set `isAuthenticated: true` in localStorage, transition `currentRoute` to `'workspace'` in under 300ms, and render live operational data without presenting a sign-up modal.

### Scenario 2: Safe Action Dual-Key Authorization
- **Given** an action item in "Waiting on Me" has risk level `HIGH` (e.g. Stripe Invoice Reminder),
- **When** an executive clicks `"Approve Action"`,
- **Then** the system must submit a cryptographically bound request to `/api/waiting-on-me/:id/approve`, verify the user's role, dispatch the mutation to Stripe, verify the outcome, append a `VERIFIED` record to the audit ledger, and remove the item from the pending queue.

### Scenario 3: Deterministic Financial Exposure Calculation
- **Given** 3 client invoices in the database with statuses `overdue` ($100k, $40k, $8.5k),
- **When** the executive queries *"What is our overdue financial exposure?"*,
- **Then** the AI response must return exactly `$148,500` derived from SQL aggregation, attach `truthLevel: DETERMINISTIC_DERIVATION`, and cite the exact Stripe invoice IDs in the evidence drawer.

### Scenario 4: Ingress Webhook HMAC Signature Verification
- **Given** an incoming webhook POST to `/api/connectors/test-webhook`,
- **When** the request header `X-SignalDesk-Signature` does not match `hmac_sha256(payload, secret)`,
- **Then** the server must reject the request immediately with `HTTP 401 Unauthorized`, discard the body, and log a security audit event.
