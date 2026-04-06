# Clarify Report — STAGE 46: Billing & Invoices

**Step:** 2 — Clarify
**Timestamp:** 2026-04-06T00:10:00.000Z
**Status:** COMPLETE

---

## Summary

The clarification scan identified 5 ambiguities in the initial stage specification. All 5 were resolved and appended to `spec.md` under `## Clarifications / Session 2026-04-06`. Security, performance, and accessibility checklists were generated. No `[NEEDS CLARIFICATION]` markers remain.

---

## Inputs Reviewed

- `specs/runtime/046-billing-and-invoices/spec.md` (including `## Clarifications`)
- `specs/phases/03_BACKOFFICE_CORE/06_COMMERCIAL_LAYER/STAGE_46_BILLING_AND_INVOICES.md`

---

## Clarifications Resolved

| #   | Question                                                     | Resolution                                                                                      | Impact                                                    |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | Is `invoice_number` unique globally or per-workspace?        | Per-workspace only — matches database-per-tenant (ADR-0001)                                     | Index scope confirmed: unique within tenant DB            |
| 2   | Gateway webhook on already-PAID invoice — 200 or 4xx?        | 200 OK with `already_processed: true` flag                                                      | Gateway retry safety — prevents false failures            |
| 3   | Can a student have multiple PENDING invoices simultaneously? | Yes — multiple PENDING allowed; only one ACTIVE subscription enforced by Stage 44 partial index | No additional DB constraint needed on invoices table      |
| 4   | Should proof re-upload replace or append?                    | Replace — `proof_file_id` updated; `proof_uploaded` audit log appended each time                | Simpler model; full audit trail preserved via log entries |
| 5   | Gateway webhook secret: env config or tenant DB?             | Environment config only (`GATEWAY_WEBHOOK_SECRET`) — not per-tenant                             | Per-tenant gateway config is a future stage concern       |

---

## Open Items

None — all ambiguities resolved.

---

## Spec Updates Applied

- `## Clarifications / Session 2026-04-06` section added to `spec.md` with all 5 Q&A pairs
- Architecture governance declaration updated to note webhook route bypass justification
- Security requirements section updated to reference `GATEWAY_WEBHOOK_SECRET` env var

---

## Checklists Generated

- `checklists/requirements.md` (from Step 1) — covers architecture, functional, security, idempotency, observability, testing
- `checklists/security.md` — covers auth, input validation, injection, data exposure, replay prevention, audit trail
- `checklists/performance.md` — covers indexes, query patterns, transaction scope, rate limiting

---

## Risk Assessment

| Risk                                           | Severity | Status                                                  |
| ---------------------------------------------- | -------- | ------------------------------------------------------- |
| Race condition on concurrent gateway callbacks | HIGH     | Mitigated — optimistic lock + idempotency_key           |
| Double subscription activation                 | HIGH     | Mitigated — `activation_date IS NULL` + SERIALIZABLE tx |
| Webhook signature misconfiguration             | HIGH     | Mitigated — startup env config validation               |
| Multiple PENDING invoices cluttering UI        | LOW      | Acceptable — listing filters handle this                |
