# Research Findings: Monorepo Setup

**Date**: 2026-02-15
**Feature**: Monorepo Setup

## Decision: Bun Workspaces Configuration

**Task**: Research best practices for Bun workspaces in monorepo setup

**Decision**: Use single bun.lockb at root with workspace:\* dependencies

**Rationale**: Ensures shared dependency graph, prevents version drift, allows atomic updates across packages

**Alternatives considered**:

- pnpm workspaces: Considered but Bun provides better runtime integration
- Individual lockfiles: Rejected due to potential conflicts and maintenance overhead

## Decision: TypeScript Path Aliases

**Task**: Research TypeScript path mapping for monorepo

**Decision**: Configure @domain/_, @types/_, @validation/_, @ui/_, @config/\* aliases in tsconfig.base.json

**Rationale**: Enables clean imports without deep relative paths, enforces package boundaries

**Alternatives considered**:

- Relative imports: Rejected due to scalability issues in large monorepo
- No aliases: Rejected as violates layering principles

## Decision: Docker Infrastructure Services

**Task**: Research Docker compose setup for Postgres 15+, Redis 7+, pgbouncer, nginx

**Decision**: Use docker-compose.yml with health checks, persistent volumes for data

**Rationale**: Provides consistent development environment, matches production infrastructure baseline

**Alternatives considered**:

- Local installations: Rejected due to version conflicts across developers
- Docker only for CI: Rejected as needed for local development

## Decision: ESLint Import Boundary Rules

**Task**: Research ESLint rules for enforcing import boundaries

**Decision**: Use eslint-plugin-import with custom rules for apps/ and packages/ restrictions

**Rationale**: Prevents architectural violations at development time

**Alternatives considered**:

- Manual code review: Insufficient for large codebase
- TypeScript path restrictions: Complements but doesn't fully enforce boundaries

## Decision: Pre-commit Hooks

**Task**: Research pre-commit setup for linting and type checking

**Decision**: Use husky + lint-staged for pre-commit hooks running ESLint, TypeScript, and formatting

**Rationale**: Catches issues before commit, maintains code quality

**Alternatives considered**:

- CI-only checks: Allows broken commits to enter repository
- Manual running: Relies on developer discipline

## Decision: Vitest Configuration

**Task**: Research testing framework setup for monorepo

**Decision**: Vitest at root with workspace support, coverage collection

**Rationale**: Fast testing, native ESM support, good monorepo integration

**Alternatives considered**:

- Jest: Considered but Vitest provides better performance and ESM support
- Per-package testing: Rejected due to shared setup complexity

## Decision: Environment Configuration

**Task**: Research .env management for monorepo

**Decision**: .env.example with full documentation, separate dev/prod configs, no secrets in repo

**Rationale**: Provides clear setup instructions, prevents accidental secret commits

**Alternatives considered**:

- Hardcoded defaults: Rejected due to security and flexibility concerns
- No documentation: Rejected as increases onboarding friction
