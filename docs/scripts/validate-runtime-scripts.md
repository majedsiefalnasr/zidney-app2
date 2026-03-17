# validate-runtime-scripts

## Command

```sh
bun run validate-runtime-scripts
```

## Purpose

CI guard script that hard-blocks (exits 1) when any `bun run <script>` reference found in
`specs/runtime/**/*.md` is absent from root `package.json`'s `scripts` block. Exits 0 when
all referenced scripts are registered.

## Why It Exists

Runtime specifications reference scripts by name. When implementation scripts are deleted,
moved, or renamed without updating `package.json`, developers encounter cryptic "command not
found" errors. This guard ensures that every script reference in specs has a corresponding
registered implementation, preventing specification-to-runtime drift.

## When to Run

- In pre-push git hooks (blocks pushes with unregistered spec references)
- In CI pipelines before merge to main
- Manually after adding new `bun run` references to spec documents
- After deleting or renaming registered scripts

## Execution Mode

`ci` | `manual`

Exits 1 on first batch of missing scripts (enumerates all missing, then exits 1).
Exits 0 when all references are registered.

## Scan Behavior

| Rule               | Detail                                               |
| ------------------ | ---------------------------------------------------- |
| Scanned directory  | `specs/runtime/**/*.md` (recursive)                  |
| Extraction regex   | `/bun run ([a-zA-Z][a-zA-Z0-9:_-]*)/g`               |
| CLI flag exclusion | Captures starting with `--` are excluded             |
| Excluded names     | `my-new-script`, `scripts`, `wrapper`, `lint:staged` |
| Deduplication      | Exact match — each name counted once                 |

## Dependencies

- Root `package.json` (compared against)
- `specs/runtime/` directory

## Example Usage

```sh
# Run guard (exits 0 if all registered, 1 if any missing)
bun run validate-runtime-scripts
```

Expected output on pass:

```json
{
  "level": "info",
  "message": "CI guard PASSED: all runtime spec script references are registered",
  "metadata": { "total": 85 }
}
```

Expected output on failure:

```json
{ "level": "error", "message": "Unregistered script reference found", "metadata": { "script": "my-missing-script" } }
{ "level": "error", "message": "CI guard FAILED: unregistered script references", "metadata": { "missing": ["my-missing-script"], "count": 1 } }
```

## Known Failure Modes

| Scenario                   | Exit Code | Behavior                                 |
| -------------------------- | --------- | ---------------------------------------- |
| Any unregistered ref found | 1         | Lists all missing scripts with error log |
| All refs registered        | 0         | Summary info log                         |
| `package.json` unreadable  | 1         | Error log with path                      |
| `specs/runtime/` missing   | 0         | Empty scan, passes trivially             |
