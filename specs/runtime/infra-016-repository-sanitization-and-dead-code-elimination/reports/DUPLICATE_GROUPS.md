# Duplicate Groups

## Group 1: Speckit Agent Definitions

- Candidate surfaces: `.github/agents/speckit.*`, `.agents/agents/speckit.*`
- Current execution survivor: `.github/agents/*`
- Consolidation action: `defer`
- Status: `manual_review`
- Reason: duplicate definitions exist, but `.github/agents` is still touched by `.specify/scripts/bash/update-agent-context.sh`, and `.agents/agents/*` also remains an active Zidney-local agent surface rather than an isolated backup.

## Group 2: Speckit Prompt Definitions

- Candidate surfaces: `.github/prompts/speckit.*`, `.agents/prompts/speckit.*`
- Current execution survivor: `unresolved`
- Consolidation action: `defer`
- Status: `manual_review`
- Reason: both prompt roots are populated, both roots are currently marked protected in this stage, and the repo search did not prove that either prompt tree is an unused legacy mirror.

## Group 3: SpecKit Template Systems

- Candidate surfaces: `.specify/templates/*`, `specs/templates/*`
- Current execution survivor: `.specify/templates/*`
- Consolidation action: `defer`
- Status: `manual_review`
- Reason: governance docs promote `specs/templates/*`, but `.specify/scripts/bash/create-new-feature.sh`, `.specify/scripts/bash/setup-plan.sh`, and `.specify/scripts/bash/update-agent-context.sh` still execute against `.specify/templates/*`.

## Group 4: Governance Handbook Overlap

- Candidate surfaces: `docs/type-safety/AI_GOVERNANCE_HANDBOOK.md`, `docs/01_ENGINEERING_GOVERNANCE/06_AI_AGENT_RULES.md`
- Current execution survivor: `unresolved`
- Consolidation action: `defer`
- Status: `manual_review`
- Reason: both cover AI governance, but the handbook still has live links from `docs/type-safety/00_INDEX.md` and `docs/type-safety/README.md`, while `06_AI_AGENT_RULES.md` remains part of governance and intelligence outputs.

## Current Outcome

- Grouping is complete for documentation, script/template, and agent/prompt duplicates within stage scope.
- Only Group 1 and Group 3 expose a current execution path, but neither is safe to consolidate under this stage because routing and template bootstrap behavior would change.
- Group 2 remains blocked because both prompt roots are protected/routing-sensitive and no inactive mirror was proven.
- Group 4 remains blocked because removing either document would break either live handbook links or a governance-indexed authority surface.
- No duplicate group reached a deletion-ready state with a fully proven survivor plus lossless merge plan.
