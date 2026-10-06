---
name: verification
description: Post-execution outcome verification, source reread patterns, and proof generation for SignalDesk actions.
---

# Verification: Don't Just Act. Prove the Outcome.

## Core Principle
Executing an API call is not sufficient. SignalDesk must verify that the real-world outcome actually occurred in the authoritative system of record.

## Verification Strategies
1. **Direct Re-read**: After updating an opportunity in Salesforce, immediately re-read the opportunity record to confirm the field value matches.
2. **Provider Webhook Reconciliation**: Match incoming delivery webhooks (e.g. Stripe charge succeeded, Resend email delivered, Slack message posted) against the pending action record.
3. **State Invariant Checking**: Confirm expected business metrics (e.g. overdue AR decreased) updated consistently.
4. **Proof Storage**: Store proof string or hash in the `AuditRecord.verificationProof` field for tamper-evident compliance.
