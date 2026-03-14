# Contract: Routing Authority Registry

## Purpose

Define the required structure and semantics for `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md` so future routing and cleanup work has one authoritative control document.

## Required Records

The registry must contain exactly one record for each routing category:

- `agents`
- `prompts`
- `templates`

## Required Fields Per Record

- `Routing Category`: `agents | prompts | templates`
- `Authoritative Root`: canonical repository path
- `Legacy Compatibility Surfaces`: one or more non-authoritative paths, or `none`
- `Consumer Classes`: list of scripts, docs, loaders, or generated indexes affected by changes
- `Direct Consumer Map`: file-by-file mapping for every live consumer that still points at a legacy surface when the category is `templates`, and for every overlapping legacy-mirrored prompt file plus any intentional legacy-absent prompt when the category is `prompts`
- `Migration Policy`: how consumers move to the authoritative root
- `Retirement Criteria`: explicit proof required before a legacy surface can be removed
- `Validation Evidence`: commands and direct entrypoint checks required before retirement

## Field Semantics

### Authoritative Root

- Must be exactly one path per routing category.
- For INFRA-21, the required values are:
  - `agents -> .agents/agents/`
  - `prompts -> .agents/prompts/`
  - `templates -> specs/templates/`

### Legacy Compatibility Surfaces

- May include `.github/agents/`, `.github/prompts/`, or `.specify/templates/`.
- Must be marked non-authoritative.
- Must include a migration or compatibility note; they cannot exist silently.

### Direct Consumer Map

- Required for the `templates` routing category.
- Must list each live script, agent guidance file, or loader that still references `.specify/templates/*`.
- Must identify the exact canonical target file or explicit compatibility policy for that consumer.
- A consumer map entry is incomplete if it names only a routing category without a concrete file path.

For the `prompts` routing category, when `.github/prompts/` remains as a compatibility surface:

- the map must list each overlapping legacy-mirrored Speckit prompt file and its authoritative `.agents/prompts/*` source
- the map must record any intentional Zidney-only prompt as `legacy_absent` rather than leaving the compatibility expectation implicit

### Retirement Criteria

- Must include same-batch consumer migration requirements.
- Must require zero unresolved direct consumers.
- Must require validation success for affected entrypoints and governance gates.

## Invariants

- No routing category may have two authoritative roots.
- A legacy surface cannot be removed if any listed consumer class still depends on it.
- The registry must stay aligned with contributor docs and shell entrypoints.
- The registry must not redefine runtime, tenant, or module-boundary architecture.
- A template legacy surface cannot be retired while any direct consumer map entry lacks canonical parity.

## Acceptance Rules

- The registry is valid only when all three routing categories are present.
- The registry is invalid if any authoritative root conflicts with the clarified spec.
- The registry is incomplete if retirement criteria or validation evidence are omitted.
