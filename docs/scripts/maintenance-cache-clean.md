# maintenance:cache-clean

## Command

```sh
bun run maintenance:cache-clean
```

## Purpose

Removes build cache directories and compiled output directories to free disk space and eliminate
stale build artifacts. Safe to run at any time — only removes directories, never source files.

## Why It Exists

Build caches accumulate over time and can cause hard-to-diagnose issues when cached artifacts
become stale. This script provides a standardized, idempotent way to clean all known cache
locations in one command.

## When to Run

- When experiencing unexpected build or hot-reload behavior
- Before a clean CI build to ensure no stale artifacts
- When disk space is low
- After major dependency updates or framework upgrades

## Execution Mode

`manual`

Idempotent: skips directories that don't exist. Always exits 0. Reports removed/skipped counts
via structured log.

## Dependencies

- No external dependencies (uses Node.js built-in `fs` module)

## Cache Directories Cleaned

| Directory             | Description                         |
| --------------------- | ----------------------------------- |
| `.turbo`              | Turborepo task cache                |
| `node_modules/.cache` | Bundler and build tool cache        |
| `apps/*/dist`         | Per-app compiled output directories |

## Example Usage

```sh
bun run maintenance:cache-clean
```

Expected output:

```json
{ "level": "info", "message": "Removed cache directory", "metadata": { "dir": ".turbo" } }
{ "level": "info", "message": "Cache clean complete", "metadata": { "removed": 3, "skipped": 1, "total": 4 } }
```

## Known Failure Modes

| Scenario                | Exit Code | Behavior                                      |
| ----------------------- | --------- | --------------------------------------------- |
| Directory doesn't exist | 0         | Skipped with info log                         |
| Permission denied       | 0         | Warn log with skip, continues with other dirs |
| All dirs removed        | 0         | Structured completion log                     |
