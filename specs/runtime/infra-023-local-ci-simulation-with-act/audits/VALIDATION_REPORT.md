# Validation Report — Local CI Simulation With Act

**Timestamp:** 2026-03-18T12:15:00+02:00

## Summary

This validation report documents the local CI validation artifacts required by the Hard Mode Guard for
`stage_production_ready` verification. It was generated after running the local CI (`bun run ci:local`) in
act-based mode.

## High-level Results

- TypeScript typecheck: PASS
- Dependencies install (bun install): PASS
- ai-context generation: PASS (warnings: ADRs directory missing)
- Biome lint & format check: PASS
- Hard Mode state validations: PASS (except where explicitly noted below)

## Warnings / Notes

- ai-context generation reported a non-fatal warning: failed to load ADRs from `docs/architecture/adr` (ENOENT). This directory may be absent in a trimmed developer checkout; confirm ADR presence when running full CI in CI environment.

## Artifacts

- The detailed logs for the local run are available in the act runtime output. For a human-friendly summary of the run, refer to the CI console output produced by `bun run ci:local`.

## Conclusion

The local validation checks required for the Hard Mode Guard exist and succeeded for this developer environment. Any remaining governance or ADR-related files should be added in the repository if they are expected by CI in your environment.

---

_Generated automatically by local CI helper on developer machine._
