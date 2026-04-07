# dev:pr:coderabbit

## Command

```sh
bun run dev:pr:coderabbit
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/dev/coderabbit-reviews.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run dev:pr:coderabbit`
- Implementation: scripts/dev/coderabbit-reviews.ts
- Metadata-backed script file: `scripts/dev/coderabbit-reviews.ts`

## Flags

| Flag              | Type      | Description                                                             | Example                                                                                                          |
| ----------------- | --------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `--resolved`      | `boolean` | Show resolved threads instead of unresolved ones.                       | `bun run dev:pr:coderabbit -- --resolved`                                                                        |
| `--unresolved`    | `boolean` | Show unresolved threads (default).                                      | `bun run dev:pr:coderabbit -- --unresolved`                                                                      |
| `--json`          | `boolean` | Output matching threads as raw JSON.                                    | `bun run dev:pr:coderabbit -- --json`                                                                            |
| `--md`            | `boolean` | Output matching threads as Markdown (default).                          | `bun run dev:pr:coderabbit -- --md`                                                                              |
| `--save`          | `string`  | Save output to the specified directory instead of printing to stdout.   | `bun run dev:pr:coderabbit -- --save`                                                                            |
| `--include-files` | `boolean` | Append full file content for each file referenced in a thread.          | `bun run dev:pr:coderabbit -- --include-files`                                                                   |
| `--max-lines`     | `number`  | Maximum lines per file block before content is omitted.                 | `bun run dev:pr:coderabbit 42 --max-lines 300`                                                                   |
| `--mark-resolved` | `boolean` | Mark all matching CodeRabbit threads as resolved after fetching.        | `bun run dev:pr:coderabbit -- --mark-resolved`                                                                   |
| `--mark-thread`   | `string`  | Mark specific thread(s) as resolved (comma-separated IDs or single ID). | `bun run dev:pr:coderabbit 92 --mark-thread threadId1 or bun run dev:pr:coderabbit 92 --mark-thread id1,id2,id3` |
| `--cleanup`       | `boolean` | Delete the saved output file after marking threads resolved.            | `bun run dev:pr:coderabbit -- --cleanup`                                                                         |
| `--ai`            | `boolean` | Emit machine-readable JSON summary to stdout instead of human output.   | `bun run dev:pr:coderabbit -- --ai`                                                                              |
| `--ci`            | `boolean` | Enable CI non-interactive mode. Disables spinners.                      | `bun run dev:pr:coderabbit -- --ci`                                                                              |

## CI Behavior

No explicit --ci handling detected in the implementation.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: `ai:context:generate`, `ai:context:refresh`
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
