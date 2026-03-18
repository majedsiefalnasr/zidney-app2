# Local CI Simulation with `act`

This document covers how to run GitHub Actions workflows locally on your development machine
using [`act`](https://github.com/nektos/act). Running CI locally allows you to catch failures
before pushing and dramatically shortens the feedback loop.

---

## What Is `act`

[`act`](https://github.com/nektos/act) is a tool that simulates GitHub Actions workflow execution
on your local machine using Docker containers. It reads your `.github/workflows/` files and runs
them inside containers that closely mirror GitHub's hosted runner environment.

**Why Zidney uses `act`:**

- Catch lint, typecheck, and architecture violations before pushing
- Avoid waiting for GitHub CI to confirm failures you could detect locally in seconds
- Verify governance checks pass before closing a stage (mandatory pre-closure gate — INFRA-023)
- Provides a fast inner loop: full CI simulation in ~5–8 minutes with Docker cache

`act` is not a replacement for GitHub CI. GitHub is the authoritative CI environment. Local
simulation is a safety net, not a parity guarantee.

---

## Installation

### macOS

```bash
brew install act
```

Docker Desktop is required. Install it from [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop).

### Linux

Download the latest release binary directly from GitHub releases (hash-verified installation):

```bash
# 1. Download the latest release
LATEST=$(curl -s https://api.github.com/repos/nektos/act/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
curl -Lo /tmp/act.tar.gz "https://github.com/nektos/act/releases/download/${LATEST}/act_Linux_x86_64.tar.gz"

# 2. Verify the checksum (download checksums.txt from the same release)
curl -Lo /tmp/act_checksums.txt "https://github.com/nektos/act/releases/download/${LATEST}/checksums.txt"
sha256sum --check --ignore-missing /tmp/act_checksums.txt

# 3. Extract and install (only after checksum passes)
tar -xzf /tmp/act.tar.gz -C /tmp act
sudo mv /tmp/act /usr/local/bin/act
chmod +x /usr/local/bin/act
```

> **Security note:** Never use `curl | bash` (or `curl | sudo bash`) for installing `act` or any
> other tool. Always download, verify the checksum, and install separately.

### Verify installation

```bash
act --version
docker info  # Docker must be running before any act invocation
```

---

## Configuration

### `.actrc` (do not modify)

The Zidney repository ships a pre-configured `.actrc` at the repository root. This file is
committed and shared across all developer machines. **Do not modify `.actrc`.**

Current content (for reference):

```
# Runner images (~1.4 GB — multi-arch: arm64 + amd64)
-P ubuntu-latest=catthehacker/ubuntu:act-latest
-P ubuntu-22.04=catthehacker/ubuntu:act-22.04
-P ubuntu-20.04=catthehacker/ubuntu:act-20.04

# Secrets + variables
--secret-file .secrets
--var-file .vars

# Artifact output
--artifact-server-path /tmp/act-artifacts

# Speed: bind workspace + reuse containers
--bind
--reuse

# Terminal UX: suppress Docker pull noise
--quiet

# Default profile: skip image pull if image exists locally
--pull=false
```

> **Note:** `--secret-file` points to `.secrets` — this is the primary secrets file. For act-only
> secrets that you don't want to pollute `.secrets`, use `.act.secrets` (see below).

### `.act.secrets` (developer-created, never committed)

Create a local `.act.secrets` file with test-safe secrets for act-only use:

```bash
# Create .act.secrets from this template (use only non-production test values)
cat > .act.secrets << 'EOF'
DATABASE_URL=postgres://user:password@localhost:5432/test_db
TEST_DATABASE_URL=postgres://user:password@localhost:5432/test_db
REDIS_URL=redis://localhost:6379
TEST_REDIS_URL=redis://localhost:6379
NODE_ENV=test
# Required for act to clone GitHub Actions (setup-bun, actions/checkout, etc.)
# Generate at: https://github.com/settings/tokens — repo scope required
GITHUB_TOKEN=ghp_<your-personal-access-token>
EOF
```

> **Warning:** Never commit `.act.secrets`. It is listed in `.gitignore` and must never appear in
> git history. Run `git check-ignore -v .act.secrets` to confirm it is excluded.

---

## Running CI Locally

### Fast run (recommended for day-to-day use)

Runs all workflows using locally cached Docker images (`--pull=false`):

```bash
bun run ci:local
```

### Full-fidelity run (with fresh image pull)

Re-pulls the Docker runner images before execution. Use before a release or when debugging
image-specific failures:

```bash
bun run ci:local:full
```

### Target a single workflow

Run only one workflow file without executing the others:

```bash
bun run ci:local:workflow ci.yml
bun run ci:local:workflow architecture-governance.yml
bun run ci:local:workflow ci-type-safety.yml
bun run ci:local:workflow hard-mode-guard.yml
bun run ci:local:workflow ai-context-validation.yml
```

### List all workflows and jobs (no containers)

```bash
bun run ci:local:list
```

### Full governance orchestrator (pre-closure)

The `run-local-ci.ts` script runs the complete 7-step governance sequence before the `act`
simulation and produces a summary table:

```bash
bun scripts/run-local-ci.ts
# or via the registered package.json key:
bun run ci:run-local
```

This is the mandatory pre-closure gate (INFRA-023). See [AGENTS.md](../../AGENTS.md) for the
enforcement rule.

---

## Performance Optimization

Out of the box, `act` can be slow due to container cold starts, full image pulls, and repository
cloning on every run. The configuration in `.actrc` already applies the three biggest wins, but
knowing why each flag exists helps you tune further.

### What `.actrc` enables by default

| Flag               | Benefit                                                           | Trade-off                                                                                     |
| ------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `--bind`           | Mounts your workspace directly into the container — no clone step | Container sees uncommitted changes; ensure workspace is clean before a final run              |
| `--reuse`          | Keeps containers alive between runs (no cold-start overhead)      | State accumulates; reset with `docker ps -aq \| xargs docker rm -f` if you see stale failures |
| `--quiet`          | Suppresses Docker pull noise; actual step output is preserved     | Slightly less verbosity for debugging Docker-level issues                                     |
| `--pull=false`     | Uses locally cached runner images                                 | Images can drift from GitHub; use `ci:local:full` periodically                                |
| `act-latest` image | ~1.4 GB vs 17 GB+ for `full-*` images                             | Fewer pre-installed tools (see Differences table)                                             |

### Target a specific job (fastest feedback loop)

When debugging a single failure, skip running all workflows:

```bash
# Run only a named job by its workflow job ID
bun run ci:local:job -- typecheck
bun run ci:local:job -- lint
bun run ci:local:job -- architecture-guard

# Or target a whole workflow file
bun run ci:local:workflow ci.yml
bun run ci:local:workflow ci-type-safety.yml
```

### Structured output for programmatic parsing

Pipe `act --json` output through `jq` to get a clean pass/fail summary:

```bash
act --json | jq 'select(.status != "running") | {job: .name, status: .status}'
```

This is useful for CI dashboards or scripted checks that need machine-readable results.

### Syntax validation without running containers

Use `actionlint` (a static workflow checker) to catch syntax errors, missing secrets, and
incorrect contexts instantly — no Docker required:

```bash
# Install once (macOS)
brew install actionlint

# Validate all workflows without spinning up any container
bun run ci:local:dry
# equivalent: actionlint .github/workflows/*.yml
```

`actionlint` catches most structural problems in under a second. Run it before `act` to avoid
wasting a full container startup on a YAML syntax error.

### Mount local Bun cache (skip reinstalls)

By default, `actions/cache` is a no-op locally (act can't communicate with GitHub's cache server).
The container reinstalls all Bun dependencies from scratch on every run. You can avoid this by
mounting your host Bun cache directly into the container.

Run this setup command **once** per machine — it appends the volume mount to `.actrc` with the
path already expanded:

```bash
# macOS / Linux (expand $HOME at setup time)
echo "--container-options=\"-v ${HOME}/.bun/install/cache:/root/.bun/install/cache:ro\"" >> .actrc
```

Verify your cache location first: `bun pm cache`

> **Note:** `.actrc` does not support shell variable expansion (`~` or `$HOME`). The command above
> expands `$HOME` in your current shell and writes the absolute path into `.actrc`.

### File watcher: auto-run on file changes (`entr`)

Combine `act` with `entr` to get an automatic local CI loop — every time a TypeScript file in a
package changes, the relevant job reruns:

```bash
# Install entr (macOS)
brew install entr

# Auto-rerun typecheck job when any .ts file in packages/ changes
find packages -name '*.ts' | entr -c bun run ci:local:job -- typecheck

# Auto-rerun lint when any source file changes
find apps packages -name '*.ts' -o -name '*.vue' | entr -c bun run ci:local:job -- lint
```

`-c` clears the terminal between runs for a clean output stream.

### Full clean run (when you need fresh images and containers)

For pre-release validation or debugging image-specific failures, explicitly override the `.actrc`
defaults:

```bash
bun run ci:local:full
# Runs: act --pull --reuse=false
# Pulls the latest runner image + creates a fresh container (no bind cache, clean state)
```

---

## Troubleshooting

| Symptom                                                             | Cause                                                                                  | Fix                                                                                                                                                                                                        |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authentication required: Invalid username or token` on every job   | `GITHUB_TOKEN` not set — `act` cannot clone GitHub Actions (setup-bun, checkout, etc.) | Add `GITHUB_TOKEN=<your-PAT>` to `.secrets` (`.actrc` uses `--secret-file .secrets`). Create a [Personal Access Token](https://github.com/settings/tokens) with `repo` scope                               |
| `Docker is not running`                                             | Docker Desktop is not started                                                          | Open Docker Desktop and wait for it to be ready                                                                                                                                                            |
| `Cannot connect to the Docker daemon`                               | Docker socket permissions                                                              | Run `sudo systemctl start docker` (Linux) or restart Docker Desktop (macOS)                                                                                                                                |
| OCI image architecture mismatch (`exec format error`)               | Running an amd64-only third-party action on Apple Silicon                              | The default `catthehacker/ubuntu:act-latest` is multi-arch — if you see this, a specific action's Docker image is amd64-only; uncomment `--container-architecture linux/amd64` in `.actrc` as a workaround |
| Stale state from `--reuse` (e.g. lock file conflict, wrong env var) | `--reuse` keeps containers alive — a previous failed run left dirty state              | Reset containers: `docker ps -aq \| xargs docker rm -f`, then re-run                                                                                                                                       |
| Workflow sees uncommitted files unexpectedly                        | `--bind` mounts your live workspace — untracked or dirty files are visible             | Expected behaviour. Commit or stash changes before runs that must mirror a clean git state                                                                                                                 |
| Missing secrets (`unset variable` in workflow)                      | `.secrets` or `.act.secrets` missing or incomplete                                     | Check that both files exist locally with the required keys                                                                                                                                                 |
| E2E tests failing (`playwright` binary not found)                   | Container image does not have Playwright browsers                                      | E2E jobs require additional setup — see the Differences from GitHub CI section below                                                                                                                       |
| `hard-mode-guard.yml` fails at "Validate protected authority files" | Step requires git SSH access to compare with remote                                    | Expected locally — this step cannot run without SSH key configured in the container                                                                                                                        |
| `hard-mode-guard.yml` fails with branch context errors              | act uses a mock branch ref by default                                                  | Override: `act -W .github/workflows/hard-mode-guard.yml --env GITHUB_REF=refs/heads/<your-branch>`                                                                                                         |
| Docker socket not available for job services                        | Docker-in-Docker not configured                                                        | Ensure Docker Desktop has "Allow the default Docker socket to be used" enabled                                                                                                                             |
| `act` exits 137 (OOM kill)                                          | Container ran out of memory                                                            | Increase Docker Desktop memory limit to at least 8GB                                                                                                                                                       |

---

## Differences from GitHub CI

`act` simulation is best-effort. Some GitHub Actions features are unavailable or behave differently
locally. The table below documents the known differences for the Zidney workflow suite.

| Feature                        | GitHub CI           | `act` Local                         | Notes                                                                            |
| ------------------------------ | ------------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| `actions/cache@v4`             | Full cache service  | No-op (cache miss on every run)     | Expect slower runs due to repeated `bun install`                                 |
| `actions/upload-artifact@v4`   | GH artifact storage | Written to `/tmp/act-artifacts`     | Configured via `--artifact-server-path` in `.actrc`                              |
| `actions/download-artifact@v4` | GH artifact storage | Read from `/tmp/act-artifacts`      | Same path as upload                                                              |
| `$GITHUB_STEP_SUMMARY`         | Job summary page    | Simulated locally                   | Not visible in outputs                                                           |
| `schedule:` trigger            | Executes on cron    | Not triggered automatically         | Use `act schedule` to simulate                                                   |
| `GITHUB_REF` (branch context)  | Actual branch name  | Mock value (`refs/heads/master`)    | Override with `--env GITHUB_REF=refs/heads/<branch>` for `hard-mode-guard.yml`   |
| Pre-installed tools            | Full hosted runner  | catthehacker:act-latest (~1.4 GB)   | Multi-arch (arm64 + amd64); most tools present; Playwright browsers not included |
| Docker service containers      | Isolated per-job    | Requires Docker socket pass-through | Services work but require correct Docker Desktop settings                        |
| E2E tests (Playwright)         | Fully supported     | Not supported in CI image           | E2E jobs expected to fail locally — excluded from pre-closure gate               |

### CI Parity Contract

Every file in `.github/workflows/` must be locally executable via `act`. Any workflow that cannot
run locally must be adapted, mocked, or have its exclusion explicitly documented before PR merge.
Violations block stage closure.

| Workflow                      | Local Compatibility | Known Limitations                                        |
| ----------------------------- | ------------------- | -------------------------------------------------------- |
| `ci.yml`                      | FULL (non-E2E jobs) | E2E jobs (Playwright): PARTIAL — require Docker services |
| `architecture-governance.yml` | FULL                | `schedule:` trigger not auto-invoked                     |
| `ci-type-safety.yml`          | FULL                | None                                                     |
| `hard-mode-guard.yml`         | PARTIAL             | Branch context injection required via `--env GITHUB_REF` |
| `ai-context-validation.yml`   | FULL                | None                                                     |

---

## Developer Workflow

### Pre-push sequence (recommended)

Run the full local CI simulation before pushing to reduce CI round-trips:

```bash
# 1. Run the full governance orchestrator (7-step sequence + act simulation)
bun run ci:run-local

# 2. If all steps pass:
git add .
git commit -m "feat(...): ..."
git push origin <branch>
```

If any step in the orchestrator fails, the script exits non-zero and prints which step failed.
Fix the issue and re-run before pushing.

### Quick pre-push check (fast mode)

For day-to-day commits where you want only the `act` simulation (no governance steps):

```bash
bun run ci:local       # fast mode: --pull=false, uses cached images
```

This is faster than `bun run ci:run-local` but skips the governance steps (validate-runtime-scripts,
validate:scripts-infra, arch:guard, etc.). Use `ci:run-local` before closing a stage.

### Automated pre-push hook (optional)

If you want `bun run ci:local` to run automatically before each `git push`, add a Husky pre-push hook:

```bash
# Run from repository root
echo 'bun run ci:local' > .husky/pre-push
chmod +x .husky/pre-push
```

> **Note:** The pre-push hook is developer-opt-in. It is not committed. Adding it is optional but
> strongly recommended before opening a PR.

### Stage closure (mandatory)

Before marking any stage as PRODUCTION READY, the mandatory pre-closure CI gate must pass:

```bash
bun run ci:run-local
# Exit code must be 0 (all 7 steps pass)
```

This is enforced by the Zidney Governance Contract (INFRA-023, see [AGENTS.md](../../AGENTS.md)).
Non-zero exit blocks stage closure. There is no bypass.
