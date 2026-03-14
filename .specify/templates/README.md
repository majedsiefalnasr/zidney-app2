# Legacy Compatibility Surface: .specify/templates/

This directory is non-authoritative.

- Canonical template root: `specs/templates/`
- Compatibility purpose: preserve legacy template paths while downstream consumers migrate
- Routing authority: `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md`

## Canonical Mapping

| Legacy Template | Canonical Target |
| --- | --- |
| `.specify/templates/spec-template.md` | `specs/templates/specify-template.md` |
| `.specify/templates/plan-template.md` | `specs/templates/plan-template.md` |
| `.specify/templates/tasks-template.md` | `specs/templates/tasks-template.md` |
| `.specify/templates/checklist-template.md` | `specs/templates/checklist-template.md` |
| `.specify/templates/constitution-template.md` | `specs/templates/constitution-template.md` |
| `.specify/templates/agent-file-template.md` | `specs/templates/agent-file-template.md` |

## Retirement Criteria

- all live consumer maps in the routing registry resolve `specs/templates/` first
- no unresolved template parity gaps remain
- compatibility retirement is validated in the same batch as the final consumer migration
