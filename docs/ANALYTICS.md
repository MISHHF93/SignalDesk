# SignalDesk — Analytics & Product Measurement Specification

**Document Identifier**: `DOC-ANA-2026-V1`  
**Status**: `CANONICAL`  
**Owner**: Product Operations & Data Engineering  
**Last Verified Against Implementation**: 2026-10-05  

---

## 1. Privacy-First Measurement Philosophy

SignalDesk measures product efficacy and friction reduction without violating executive confidentiality.

### Privacy Invariants:
1. **Zero Content Logging**: Raw customer emails, employee names, invoice dollar totals, and API credentials are never logged to product analytics streams.
2. **Action Telemetry Only**: Analytics capture discrete state transitions and latency (e.g. `action_approved`, `situation_resolved`, `ai_query_latency_ms`).
3. **No Third-Party Ad Trackers**: No Facebook Pixel, Google Ads remarketing cookies, or invasive session replay tools running in the authenticated Command Center.

---

## 2. Core Operational Event Taxonomy

| Event Name | Trigger Context | Payload Properties | Success Metric Tie |
| :--- | :--- | :--- | :--- |
| `portal_visit` | PublicWebsite mounts | `referrer`, `language`, `deviceType` | Visitor acquisition |
| `instant_launch_clicked`| User clicks "Launch Command Center" | `source: 'hero' \| 'nav'` | Time to Value (TTV) |
| `google_sso_initiated` | User clicks "Sign in with Google" | `method: 'pkce_popup' \| 'direct_email'`| Enterprise adoption |
| `google_sso_completed` | Server validates Google token | `tenantDomain`, `durationMs` | Auth conversion |
| `situation_resolved` | User clicks "Take Care of This" | `situationId`, `category`, `urgency` | Founder time saved |
| `action_approved` | User clicks "Approve Action" in queue | `targetSystem`, `riskLevel`, `timeToApproveSec` | Decision velocity |
| `action_declined` | User clicks "Decline" in queue | `targetSystem`, `reasonCategory` | False positive rate |
| `ai_query_submitted` | User submits prompt in Command Center| `intentClass`, `capabilityUsed`, `latencyMs` | Radar utility |
| `connector_probed` | User clicks "Probe Live Gateway" | `toolId`, `latencyMs`, `status` | Gateway health |
| `briefing_audio_played` | User clicks "Listen to Briefing" | `durationSec`, `completed` | Executive habit loop |

---

## 3. Product KPI Dashboard & Targets

```
┌─────────────────────────────────┬─────────────────┬────────────────────┐
│ North Star KPI                  │ Target          │ Measurement Method │
├─────────────────────────────────┼─────────────────┼────────────────────┤
│ Time to Value (First Session)   │ < 10 seconds    │ instant_launch     │
│ Weekly Decision Velocity        │ ≥ 15 actions/wk │ action_approved    │
│ Triage Resolution Rate          │ ≥ 85% in < 24h  │ situation_resolved │
│ Zero-Hallucination Audit Score  │ 100% Grounded   │ AI Truth Validator │
│ System Uptime & SLA             │ 99.95% Uptime   │ /api/system/health │
└─────────────────────────────────┴─────────────────┴────────────────────┘
```
