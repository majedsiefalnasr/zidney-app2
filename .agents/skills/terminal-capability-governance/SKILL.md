---
name: terminal-capability-governance
description: Use when a workflow must detect RTK, jq, rg, fd, gitnexus, or ast-grep availability, establish command preference hierarchy, or apply guarded shell fallbacks without losing deterministic behavior.
---

# Terminal Capability Governance

This skill governs terminal capability detection and safe command fallbacks for Zidney workflows.

Use it when a workflow depends on optional local tools and must still behave predictably when they are absent.

## Required Behavior

1. Detect `rtk`, `jq`, `rg`, `fd`, `gitnexus`, and `sg` once per session and cache the results.
2. Prefer RTK for large-file inspection and token-aware output reduction.
3. Use the documented command preference hierarchy instead of ad hoc shell choices.
4. Apply guarded fallbacks when a preferred tool is missing.
5. Surface installation guidance for RTK and other critical tooling when fallbacks are activated.

## Command Preference Hierarchy

| Operation | Preferred | Fallback |
| --- | --- | --- |
| Large file inspection | `rtk summarize` | `head -100` with warning |
| Search | `rg` | `grep -r` |
| File discovery | `fd` | `find` |
| JSON inspection | `jq` | `python3` or `node` |
| Structural search | `sg` | scoped text search |

## Fallback Expectations

- RTK fallback must warn before large output is truncated
- Searches must stay scoped; never fall back to repo-wide noisy scans without path limits
- Cached capabilities should only be re-detected if a previously working tool fails unexpectedly

## Non-Goals

- This skill does not decide workflow sequencing.
- This skill does not override terminal-safety constraints or package-manager rules.
