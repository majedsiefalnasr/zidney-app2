# Copilot Commit Message Instructions

Use Zidney's Conventional Commit format:

- `type(stage): description`
- Allowed `type` values: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `infra`
- On `spec/<stage>` branches, the `stage` value must match the branch suffix exactly

Examples:

- `feat(040-grading-core): align orchestrator governance hooks`
- `fix(infra-004-biome): correct hook validation wiring`
