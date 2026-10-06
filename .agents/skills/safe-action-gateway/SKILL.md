---
name: safe-action-gateway
description: Governed execution lifecycle, policy checks, dual-key approval, and audit trails for all mutating operations.
---

# Safe Action Gateway

## Lifecycle State Machine
`PROPOSED` → `POLICY_CHECK` → `APPROVAL_REQUIRED` / `APPROVED` → `EXECUTING` → `VERIFYING` → `VERIFIED` / `FAILED`

## Guarantees
1. **Binding Approvals**: Approval binds to exact actor, tenant, action class, parameters, and time expiration (TTL).
2. **Idempotency & Replay Protection**: Nonces and action IDs prevent duplicate execution on retry.
3. **Dual-Key Governance**: Consequential financial modifications (> $1,000 USD), customer-facing contract changes, or bulk deletion require dual authorization.
4. **Audit Trail**: Every action logs timestamp, actor identity, target system, parameter snapshot, and cryptographic verification proof.
