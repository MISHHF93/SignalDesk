# SignalDesk — Environment & Configuration Specification

**Document Identifier**: `DOC-ENV-2026-V1`  
**Status**: `CANONICAL`  
**Source of Truth**: `src/server/envConfig.ts`, `src/server/cleanEnv.ts`  
**Owner**: DevOps & Infrastructure  
**Last Verified Against Implementation**: 2026-10-05  

---

## 1. Configuration Principles

- **Zero Secrets in Repository**: No API keys, database passwords, or HMAC signing secrets may be committed to git.
- **`.env.example` as Template**: All supported variables are defined in `.env.example` with non-sensitive placeholder formats.
- **Server-Side Exclusivity**: Secrets must never be prefixed with `VITE_` unless explicitly intended for browser bundle inclusion.
- **Hardware Isolation**: In production, secrets are mounted from Google Cloud Secret Manager into environment variables.

---

## 2. Canonical Environment Variables Matrix

| Variable Name | Category | Scope | Required | Is Secret | Purpose |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `GEMINI_API_KEY` | Google Gemini AI | Production / Dev | **YES** | **YES** | Primary API key for Gemini 2.5 Flash / Pro reasoning. |
| `DATABASE_URL` | Persistence (Cloud SQL)| Production / Dev | **YES** | **YES** | PostgreSQL 16 connection string (SSL required in production). |
| `PORT` | Runtime | Production / Dev | Optional | No | Server listen port. Defaults to `3000`. |
| `APP_URL` / `CANONICAL_APP_URL` | Runtime | Production | **YES** | No | Canonical production origin for OAuth redirects and webhooks. |
| `SESSION_SECRET` | Security & Governance | Production | **YES** | **YES** | Cryptographic key used to sign session cookies. |
| `WEBHOOK_HMAC_SECRET` | Ingress Gateway | Production | **YES** | **YES** | Master HMAC-SHA256 key for webhook signature validation. |
| `GOOGLE_MAPS_API_KEY` | Maps Platform | Optional | No | **YES** | Grounds logistics, fleet routing, and vendor geolocation. |
| `HUBSPOT_CLIENT_ID` | CRM Integration | Optional | No | No | OAuth 2.0 Client ID for HubSpot CRM sync. |
| `HUBSPOT_CLIENT_SECRET`| CRM Integration | Optional | No | **YES** | OAuth 2.0 Client Secret for HubSpot token exchange. |
| `STRIPE_SECRET_KEY` | Financial & Billing | Optional | No | **YES** | Stripe API key for live billing and invoice reconciliation. |
| `STRIPE_WEBHOOK_SECRET`| Financial & Billing | Optional | No | **YES** | Stripe webhook signature secret (`whsec_...`). |
| `QUICKBOOKS_CLIENT_ID` | Accounting Integration| Optional | No | No | Intuit Developer OAuth Client ID for QuickBooks Online. |
| `QUICKBOOKS_CLIENT_SECRET`| Accounting Integration| Optional | No | **YES** | Intuit Developer OAuth Client Secret. |
| `SALESFORCE_CLIENT_ID` | CRM Integration | Optional | No | No | Connected App Consumer Key for Salesforce OAuth. |
| `SALESFORCE_CLIENT_SECRET`| CRM Integration | Optional | No | **YES** | Connected App Consumer Secret. |

---

## 3. Diagnostic & Environment Verification

Administrators can inspect environment status without exposing sensitive credentials at `GET /api/system/environment` or via the **Environment & Config Vault** tab in Connector Settings (`EnvironmentVaultView.tsx`).

Secrets are strictly masked before serialization:
`sk_live_••••••••9a2f` (only first 4 and last 4 characters visible).
