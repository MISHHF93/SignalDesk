# SignalDesk — Error Handling & Recovery Model

**Document Identifier**: `DOC-ERR-2026-V1`  
**Status**: `CANONICAL`  
**Owner**: Reliability Engineering & Platform Architecture  
**Last Verified Against Implementation**: 2026-10-05  

---

## 1. Executive Error Communication Principles

In an executive system of intelligence, obscure stack traces or generic "Something went wrong" messages destroy trust. SignalDesk enforces a strict 3-part error communication formula:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. WHAT HAPPENED    │ Exact factual description of the failure.        │
│ 2. WHAT IT AFFECTS  │ Operational blast radius (e.g. Stripe sync only). │
│ 3. WHAT CAN BE DONE │ Clear, actionable next step for the operator.    │
└────────────────────────────────────────────────────────────────────────┘
```

**Example Customer Error**:
> *"HubSpot OAuth token expired 18 minutes ago. Deal pipeline updates from CRM are paused, but existing invoices and engineering blockers remain visible. Click **Reconnect HubSpot** in Connector Settings to refresh credentials."*

---

## 2. Error Taxonomy & Failure Modes

| Error Class | Root Cause | System Response | Customer Messaging | Recovery Strategy |
| :--- | :--- | :--- | :--- | :--- |
| `ERR_AUTH_EXPIRED` | Refresh token revoked or expired in SaaS provider. | Marks connector `RECONNECT_REQUIRED`. | "Session expired in [Tool]. Re-authorization required." | Executive clicks 1-click OAuth reconnection. |
| `ERR_HMAC_INVALID` | Ingress webhook failed SHA-256 HMAC verification. | Discards payload, logs security audit alert, returns 401. | Silent to operator; flagged in Security Audit Log. | Verifies shared secret in Connector Settings. |
| `ERR_POLICY_REJECT` | Action blocked by Safe Action Gateway guardrail. | Halts execution, sets status to `APPROVAL_REQUIRED`. | "Action requires dual-key signoff: [Reason]." | Promoted to "Waiting on Me" queue for manual sign-off. |
| `ERR_DB_UNAVAILABLE`| Transient Cloud SQL connection interruption. | Serves cached operational state from in-memory cache. | "Operating under local policy cache. Reconnecting..." | Automatic pool reconnect with exponential backoff. |
| `ERR_RATE_LIMITED` | SaaS provider rate limit reached (e.g. Jira 429). | Pauses worker thread, engages backoff queue. | "Rate limit reached on [Tool]. Sync resumed in X sec." | Auto-heal throttles request rate per minute. |
| `ERR_AI_TIMEOUT` | Gemini API response delay > 15 seconds. | Aborts request, returns deterministic graph records. | "AI synthesis timed out. Displaying raw verified facts." | Graceful fallback to SQL aggregation data. |

---

## 3. Auto-Heal & Retry Engine (`ToolSetupView.tsx`)

Every connector configuration incorporates an autonomous self-healing circuit:
- **Max Retries**: Default 3 attempts with exponential backoff (1s, 4s, 16s).
- **Circuit Breaker**: If 5 consecutive sync jobs fail, the connector transitions to `degraded` and triggers an alarm chime in the Command Center.
- **Graceful Fallback**: The client never crashes on network interruption; `App.tsx` retains the previous operational state snapshot in `localStorage`.
