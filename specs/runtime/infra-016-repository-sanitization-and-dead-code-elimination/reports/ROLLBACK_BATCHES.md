# Rollback Batches

## B01-finder-noise

- Scope: `apps/.DS_Store`, `packages/.DS_Store`, `scripts/.DS_Store`, `docs/.DS_Store`
- Reason: confirmed Finder-noise files inside approved cleanup roots
- Rollback method: restore only the deleted `.DS_Store` files if any validation gate indicates an unexpected repository dependency
- Validation checkpoint: run repository validation gates before starting the next cleanup batch
- Status: retained after validation; no batch-local regression detected

## B02-dead-scripts-and-dependencies

- Scope: remaining unprotected `scripts/` candidates and non-governance `package.json` entries
- Reason: intended second batch after Finder-noise cleanup if zero unresolved references were proven
- Rollback method: revert only the script or manifest changes in the batch and reclassify the affected candidate to `retain` or `manual_review`
- Validation checkpoint: rerun repository validation gates plus workflow and hook integrity checks if `package.json` or referenced scripts change
- Status: deferred; no candidate reached zero unresolved references in the current evidence set

## B03-duplicate-consolidation

- Scope: duplicate documentation, prompt, agent, template, and skill-routing surfaces
- Reason: intended only if one authoritative survivor and any required merge behavior were proven for each duplicate group
- Rollback method: restore the removed duplicate and revert only the current duplicate-consolidation diff
- Validation checkpoint: rerun repository validation gates and verify protected governance authority files plus contributor-routing paths remain intact
- Status: deferred; current duplicate groups remain `manual_review`

## B04-out-of-scope-generated-output

- Scope: `coverage/.tmp/coverage-*.json` and `tsconfig.base.json.backup`
- Reason: likely stale output or backup artifacts discovered during review
- Rollback method: restore only the touched support-surface files if a future approved batch removes them
- Validation checkpoint: support-surface reference audit only; no removal approved in this stage
- Status: blocked; outside the currently approved governed cleanup roots

## Final Batch Order

1. `B01-finder-noise` applied and retained.
2. `B02-dead-scripts-and-dependencies` deferred because zero-reference proof was not established.
3. `B03-duplicate-consolidation` deferred because authoritative survivors were not safe to enforce in this stage.
4. `B04-out-of-scope-generated-output` blocked because the discovered artifacts are outside the approved cleanup roots.
