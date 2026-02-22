chore({{STAGE_DIR_NAME}}): close stage as production ready

Step: Closure (7/7)
Stage: {{STAGE_NAME}}
Phase: {{PHASE_NAME}}
Status: PRODUCTION READY

Tasks: {{TASKS_COMPLETED}}/{{TASKS_TOTAL}} completed
Risk: {{RISK_LEVEL}}

─── Scope Delivered ───────────────────────────────────────
{{SCOPE_ITEM_1}}
{{SCOPE_ITEM_2}}
{{SCOPE_ITEM_3}}
{{SCOPE_ITEM_4}}

─── Deferred ──────────────────────────────────────────────
{{DEFERRED_SCOPE_SUMMARY}}

─── Constitutional Compliance ─────────────────────────────
✅ ADR-0001 Database-per-tenant isolation
✅ ADR-0002 Snapshot immutability (if applicable)
✅ ADR-0006 Server-authoritative time
✅ ADR-0007 Version compatibility
✅ ADR-0008 Semantic versioning
✅ Drift analysis: PASSED (all criteria)
✅ All writes transactional
✅ Idempotency enforced
✅ Structured logging present

─── Artifacts ─────────────────────────────────────────────
specs/runtime/{{STAGE_DIR_NAME}}/
reports/SPECIFY_REPORT.md
reports/CLARIFY_REPORT.md
reports/PLAN_REPORT.md
reports/TASKS_REPORT.md
reports/ANALYZE_REPORT.md
reports/IMPLEMENT_REPORT.md
reports/CLOSURE_REPORT.md
TESTING_GUIDE.md
PR_SUMMARY.md
README.md

Closes: specs/phases/{{PHASE_NAME}}/{{STAGE_FILE_NAME}}
