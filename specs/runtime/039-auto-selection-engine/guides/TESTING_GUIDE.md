# TESTING_GUIDE — Auto Selection Engine (Stage 39)

## Quick Start

1. Checkout the feature branch:

   ```bash
   git checkout spec/039-auto-selection-engine
   ```

2. Install dependencies (bun):

   ```bash
   bun install
   ```

## Unit & Integration

- Run unit tests:

  ```bash
  bun run test:unit
  ```

- Run integration tests:

  ```bash
  bun run test:integration
  ```

## Linting & Typecheck

- Lint and format check:

  ```bash
  bun run lint
  bun run format:check
  ```

- Type check:

  ```bash
  bun run typecheck
  ```

## Local CI Simulation

Run the local CI simulation to reproduce governance checks (may require Docker):

```bash
bun run ci:run-local
```

## Smoke Manual Test

1. Start the API locally:

   ```bash
   bun run dev:api
   ```

2. Run a quick attempt-start flow against the local server (use Postman or curl) using a test tenant and exam config.

3. Verify attempt snapshot contains `selected_question_ids` and `random_seed`, and that selected IDs are persisted to `attempt_questions`.

## Security & Scans

- Run dependency and secret scans:

  ```bash
  bun run infra:security
  ```

## Notes

- If CI fails in remote runners with git-clone/cache errors, re-run `bun run ci:run-local` after clearing the local act cache or push the branch to run on CI provider.
