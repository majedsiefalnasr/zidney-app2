# Legacy Compatibility Surface: .github/prompts/

This directory is non-authoritative.

- Canonical prompt root: `.agents/prompts/`
- Compatibility purpose: mirror only the overlapping Speckit prompt subset
- Zidney-only prompts remain authoritative-only under `.agents/prompts/`
- Routing authority: `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md`

## Retirement Criteria

- all tooling and contributor guidance stop loading `.github/prompts/*`
- the overlapping prompt subset is migrated in the same batch as any removal
- intentional `legacy_absent` prompts remain documented in the routing registry
