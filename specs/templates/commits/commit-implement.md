feat({{STAGE_DIR_NAME}}): complete implement step

Step: Implement (6/7) Stage: {{STAGE_NAME}} Phase: {{PHASE_NAME}} Status: BACKEND CLOSED

Tasks completed: {{TASKS_COMPLETED}}/{{TASKS_TOTAL}} Deferred tasks: {{DEFERRED_COUNT}}
({{DEFERRED_JUSTIFICATION_SUMMARY}}) Lines of code: ~{{LOC_ESTIMATE}}

Implementation scope:

- {{IMPL_SCOPE_1}}
- {{IMPL_SCOPE_2}}
- {{IMPL_SCOPE_3}}

Validations passed:

- Unit tests: {{UNIT_TEST_STATUS}}
- Integration tests: {{INTEGRATION_TEST_STATUS}}
- Lint: {{LINT_STATUS}}
- Type check: {{TYPECHECK_STATUS}}
- Migration: {{MIGRATION_STATUS}}
- Architecture guard: {{ARCH_GUARD_STATUS}}

Files changed: {{FILES_CHANGED_LIST}}

Artifacts:

- specs/runtime/{{STAGE_DIR_NAME}}/reports/IMPLEMENT_REPORT.md
- specs/phases/{{PHASE_NAME}}/{{STAGE_FILE_NAME}} (status: BACKEND CLOSED)
- specs/runtime/.workflow-state.json
