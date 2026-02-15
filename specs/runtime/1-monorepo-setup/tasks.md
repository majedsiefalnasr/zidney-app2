# Tasks: Monorepo Setup

**Input**: Design documents from `/specs/runtime/1-monorepo-setup/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: The examples below include test tasks. Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- **Web app**: `backend/src/`, `frontend/src/`
- **Mobile**: `api/src/`, `ios/src/` or `android/src/`
- Paths shown below assume single project - adjust based on plan.md structure

<!--
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.

  The /speckit.tasks command MUST replace these with actual tasks based on:
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Feature requirements from plan.md
  - Entities from data-model.md
  - Endpoints from contracts/

  Tasks MUST be organized by user story so each story can be:
  - Implemented independently
  - Tested independently
  - Delivered as an MVP increment

  DO NOT keep these sample tasks in the generated tasks.md file.
  ============================================================================
-->

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create repository structure with apps/ and packages/ directories
- [x] T002 Initialize Bun workspace configuration in package.json
- [x] T003 Create root configuration files (tsconfig.base.json, .env.example)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

Examples of foundational tasks (adjust based on your project):

- [x] T004 Configure TypeScript strict settings and path aliases
- [x] T005 [P] Setup Vitest testing framework with coverage
- [x] T006 [P] Configure ESLint and Prettier with import boundary rules
- [x] T007 [P] Setup husky pre-commit hooks
- [x] T008 Create Docker infrastructure (docker-compose.yml for Postgres, Redis)
- [x] T009 Prepare database baseline structure (apps/api/src/db/master/, tenant/)
- [x] T010 Implement worker baseline (connect to Redis, structured logging)
- [x] T011 Configure environment variables and documentation

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Developer Initializes Monorepo Structure (Priority: P1) 🎯 MVP

**Goal**: Establish the repository structure and workspace boundaries for Zidney development

**Independent Test**: Repository structure matches specification and Bun workspace functions correctly

### Implementation for User Story 1

- [x] T012 [US1] Create apps/ directory structure (api, worker, mmc, backoffice, frontoffice)
- [x] T013 [US1] Create packages/ directory structure (domain-core, types, validation, ui-system, redis-utils, config)
- [x] T014 [US1] Initialize package.json files for all apps and packages
- [x] T015 [US1] Configure Bun workspaces in root package.json
- [x] T016 [US1] Create AGENTS.md with architectural rules
- [x] T017 [US1] Setup import boundary enforcement in ESLint

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Developer Configures TypeScript Baseline (Priority: P2)

**Goal**: Enforce strict TypeScript configuration across the monorepo

**Independent Test**: TypeScript compiler passes with strict settings on baseline code

### Implementation for User Story 2

- [x] T018 [US2] Create tsconfig.base.json with strict settings
- [x] T019 [US2] Configure path aliases (@domain/_, @types/_, etc.)
- [x] T020 [US2] Setup TypeScript configuration for each app and package
- [x] T021 [US2] Configure Vitest for TypeScript testing
- [x] T022 [US2] Add type checking to pre-commit hooks

**Checkpoint**: TypeScript baseline enforced

---

## Phase 5: User Story 3 - Developer Sets Up Docker Infrastructure (Priority: P3)

**Goal**: Provide Docker services for development environment

**Independent Test**: Docker containers run Postgres, Redis, and other services successfully

### Implementation for User Story 3

- [x] T023 [US3] Create docker-compose.yml with Postgres 15+, Redis 7+, pgbouncer, nginx
- [x] T024 [US3] Configure health checks for all services
- [x] T025 [US3] Setup persistent volumes for data
- [x] T026 [US3] Document Docker setup in quickstart.md
- [x] T027 [US3] Test service connectivity from apps

**Checkpoint**: Infrastructure services running

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Final touches and validation

- [x] T028 Update root README.md with setup instructions
- [x] T029 Validate all import boundaries are enforced
- [x] T030 Run full linting and type checking suite
- [x] T031 Test monorepo build and test commands
- [x] T032 Document environment configuration requirements

## Dependencies

User Story 1 (P1) → User Story 2 (P2) + User Story 3 (P3)

## Parallel Execution Examples

- After US1 complete: US2 and US3 can run in parallel
- Within US2: T019, T020, T021 can be parallel
- Within US3: T023, T024, T025 can be parallel

## Implementation Strategy

MVP: Complete User Story 1 for basic monorepo structure.  
Incremental: Add TypeScript baseline (US2), then Docker infra (US3).  
Parallel: US2 and US3 after US1 foundation.
