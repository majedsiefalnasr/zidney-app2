# Validation Report — <STAGE_NAME>

**Step:** 6.5 — Mandatory Validation Gate  
**Timestamp:** <ISO_TIMESTAMP>  
**Status:** PASS / BLOCKED

---

## Summary

[Brief summary of validation execution and result.]

---

## Inputs Reviewed

- `specs/runtime/<STAGE_DIR_NAME>/tasks.md`
- `specs/runtime/<STAGE_DIR_NAME>/plan.md`
- Implementation diffs and generated tests

---

## Validation Matrix

| Validation Check                                   | Required    | Command(s)  | Result            | Notes |
| -------------------------------------------------- | ----------- | ----------- | ----------------- | ----- |
| Unit tests (impacted business logic)               | Yes         | `<COMMAND>` | ✅ / ❌ / SKIPPED | ...   |
| Integration tests (impacted API flows)             | Yes         | `<COMMAND>` | ✅ / ❌ / SKIPPED | ...   |
| Snapshot tests (grading behavior, if applicable)   | Conditional | `<COMMAND>` | ✅ / ❌ / N/A     | ...   |
| Lint                                               | Yes         | `<COMMAND>` | ✅ / ❌ / SKIPPED | ...   |
| Type check                                         | Yes         | `<COMMAND>` | ✅ / ❌ / SKIPPED | ...   |
| Migration validation (if schema changed)           | Conditional | `<COMMAND>` | ✅ / ❌ / N/A     | ...   |
| Idempotency replay validation (critical endpoints) | Yes         | `<COMMAND>` | ✅ / ❌ / SKIPPED | ...   |
| Concurrency validation (critical flows)            | Yes         | `<COMMAND>` | ✅ / ❌ / SKIPPED | ...   |

---

## Command Evidence

### Unit Tests

```text
[Paste command and key output]
```

### Integration Tests

```text
[Paste command and key output]
```

### Snapshot Tests (if applicable)

```text
[Paste command and key output, or N/A justification]
```

### Lint

```text
[Paste command and key output]
```

### Type Check

```text
[Paste command and key output]
```

### Migration Validation (if applicable)

```text
[Paste command and key output, or N/A justification]
```

### Idempotency Replay Validation

```text
[Paste command and key output]
```

### Concurrency Validation

```text
[Paste command and key output]
```

---

## Failures and Risks

- [List each failure/risk with severity and impact, or `None`]

---

## Skip Approvals

If any required validation is skipped, record explicit user approval and reason.

| Check | Approval Source | Reason |
| ----- | --------------- | ------ |
| ...   | ...             | ...    |

---

## Final Gate Decision

`PASS — All required validations completed successfully.`  
OR  
`BLOCKED — Validation gate failed. Remediation required before closure.`

---

## Next Step

Proceed to Step 6.6 — Pre-Closure Guardian Validation.
