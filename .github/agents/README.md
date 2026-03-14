# Legacy Compatibility Surface: .github/agents/

This directory is non-authoritative.

- Canonical agent root: `.agents/agents/`
- Compatibility purpose: preserve existing contributor tooling and generated outputs such as
  `.github/agents/copilot-instructions.md`
- Routing authority: `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md`

## Retirement Criteria

- `update-agent-context.sh` no longer writes `.github/agents/*`
- all downstream consumers migrate to `.agents/agents/`
- retirement occurs in the same batch as the final consumer migration with full validation evidence
