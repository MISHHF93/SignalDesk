# SignalDesk — Observability & Telemetry Model

**Document Identifier**: `DOC-OBS-2026-V1`  
**Status**: `CANONICAL`  
**Owner**: Site Reliability Engineering (SRE) & Observability  
**Last Verified Against Implementation**: 2026-10-05  

---

## 1. Observability Principles

1. **Zero Secret Logging**: Tokens, Bearer credentials, HMAC secrets, and customer PII are strictly excluded from console output, Cloud Logging, and telemetry events.
2. **Correlation ID Everywhere**: Every incoming HTTP request, webhook, and background mission step carries a traceable `correlationId`.
3. **Structured JSON Telemetry**: Server logs output structured JSON formatted for ingestion into Google Cloud Logging and Datadog.

---

## 2. Core Telemetry Signals & Metrics

```
┌─────────────────────────────────┬──────────────────────┬──────────────────────┐
│ Signal Category                 │ Metric Name          │ Alert Threshold      │
├─────────────────────────────────┼──────────────────────┼──────────────────────┤
│ System Availability             │ `http_request_2xx`   │ < 99.9% over 15m     │
│ Server Response Time            │ `http_latency_ms`    │ P95 > 450ms          │
│ Ingress Webhook Throughput      │ `webhook_ingress_count`│ Drop > 50% vs baseline │
│ Webhook HMAC Failures           │ `webhook_auth_failures`│ > 3 failures / min   │
│ Autonomous Action Approvals     │ `action_approval_rate` │ Monitored for audits │
│ Safe Action Verification Errors │ `action_verify_errors`│ > 0 occurrences      │
└─────────────────────────────────┴──────────────────────┴──────────────────────┘
```

---

## 3. Health & Telemetry Endpoints (`server.ts`)

- `GET /api/health`: Lightweight HTTP 200 liveness probe for Cloud Run container orchestrator.
- `GET /api/system/health`: Detailed telemetry probe reporting database connection status, memory consumption, active missions, and registered capabilities count.
- `GET /api/connectors`: Reports per-system latency, uptime percentage, and 24-hour event ingest volume.
- `POST /api/connectors/:id/test`: Executes live on-demand diagnostic probe testing TLS handshake and schema integrity.
