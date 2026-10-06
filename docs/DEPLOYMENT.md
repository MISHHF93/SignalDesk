# SignalDesk — Deployment & Operations Runbook

**Document Identifier**: `DOC-OPS-2026-V1`  
**Status**: `CANONICAL`  
**Target Environment**: Google Cloud Run (Containerized Node.js 20+)  
**Owner**: DevOps & Release Engineering  
**Last Verified Against Implementation**: 2026-10-05  

---

## 1. Production Architecture Overview

SignalDesk deploys as a containerized full-stack application on **Google Cloud Run**:
- **Port Requirement**: Listens strictly on `PORT 3000` (or `process.env.PORT`).
- **Entry Point**: `tsx server.ts` (development) / `node dist/server.js` or `tsx server.ts` (production).
- **Static Assets**: Vite compiles the React SPA into `dist/`. In production, Express mounts `express.static('dist')`.

---

## 2. Build & Verification Pipeline

```bash
# 1. Dependency Installation
npm install

# 2. Type & Lint Verification (Zero Errors Required)
npm run lint       # Runs 'tsc --noEmit'

# 3. Production Asset Compilation
npm run build      # Executes 'vite build' -> outputs to dist/

# 4. Production Smoke Verification
node -e "fetch('http://localhost:3000/api/system/health').then(r=>r.json()).then(console.log)"
```

---

## 3. Production Smoke Test Procedure

Following a deployment to Cloud Run, execute the canonical 5-point verification suite:

1. **Root HTML Ingress**:
   - `curl -I https://<app-domain>/` → Must return `HTTP/2 200 OK` and contain `<title>SignalDesk — Unified Business Command Center</title>`.
2. **System Health Probe**:
   - `curl -s https://<app-domain>/api/system/health` → Must return `{"status":"ok", ...}`.
3. **MCP Capability Registry**:
   - `curl -s https://<app-domain>/api/mcp/capabilities` → Must return `{"success":true,"count":51,...}`.
4. **State API Synchronization**:
   - `curl -s https://<app-domain>/api/state` → Must return situations, waiting items, and connected tools.
5. **Instant Executive Launch**:
   - Navigate to `https://<app-domain>/` → Click **"Launch Command Center"** → Workspace must load with zero console errors.

---

## 4. Rollback & Emergency Recovery

- If a newly deployed revision fails health checks or exhibits elevated latency (> 1000ms), immediately execute a Cloud Run traffic rollback:
  ```bash
  gcloud run services update-traffic signaldesk --to-revisions=PREVIOUS_REVISION=100
  ```
- Database migrations in `packages/persistence/` are designed to be backward-compatible (expand before contract) to allow instant zero-downtime rollback.
