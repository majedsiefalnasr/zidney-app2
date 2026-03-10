chore({{STAGE_DIR_NAME}}): complete analyze step

Step: Analyze (5/7) Stage: {{STAGE_NAME}} Phase: {{PHASE_NAME}} Status: IN PROGRESS

Drift analysis verdict: {{DRIFT_VERDICT}} Composite guardian verdict: {{GUARDIAN_VERDICT}} Final
gate: {{FINAL_GATE}}

Criteria evaluated: {{CRITERIA_TOTAL}} Criteria passed: {{CRITERIA_PASSED}} Violations found:
{{VIOLATIONS_COUNT}}

{{#if VIOLATIONS}} Violations:

- {{VIOLATION_1}}
- {{VIOLATION_2}} {{/if}}

Implementation authorized: {{IMPLEMENTATION_ALLOWED}}

Artifacts:

- specs/runtime/{{STAGE_DIR_NAME}}/reports/ANALYZE_REPORT.md
- specs/phases/{{PHASE_NAME}}/{{STAGE_FILE_NAME}} (status: IN PROGRESS)
- specs/runtime/.workflow-state.json
