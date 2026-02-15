## ZIDNEY – TEAM ENGINEERING GUIDELINES

Version: 1.0
Status: Mandatory Compliance
Applies To: All Engineers & AI Agents

---

## 🎯 PURPOSE

Define:

- Coding rules
- Architecture boundaries
- Review requirements
- Naming conventions
- AI behavior constraints
- Git workflow discipline

This document is binding.

---

## 🏗 ARCHITECTURE RULES

### 1️⃣ Layering Enforcement

Backend layers must follow:

Controller → Service → Repository → Database

Forbidden:

- Controller accessing DB directly
- Service importing controller
- Cross-app imports

---

### 2️⃣ Import Boundaries

Allowed:

- apps/_ → packages/_
- packages/\* → no app imports

Forbidden:

- frontend importing backend code
- mmc importing backoffice domain code
- cross-tenant database access

---

### 3️⃣ Multi-Tenancy Rule

- No shared tenant tables
- No global student table
- Every workspace = isolated DB
- Tenant ID must never be optional

---

## 🧠 AI AGENT RULES

AI must:

- Read relevant spec stage before generating code
- Follow stage number ordering
- Not invent undocumented fields
- Not bypass architecture layering
- Not generate direct DB access in frontend

AI must never:

- Collapse layers
- Skip validation logic
- Generate insecure shortcuts
- Assume cross-tenant access

---

## 🧾 NAMING CONVENTIONS

### Backend

- Tables: snake_case
- Columns: snake_case
- DTOs: PascalCase
- Services: PascalCase + Service
- Controllers: PascalCase + Controller

Example:

UserService  
AttemptController  
license_limit

---

### Frontend

- Components: PascalCase.vue
- Stores: useXStore
- API files: kebab-case.ts
- Types: PascalCase

---

### Spec Files

- STAGE_XX_NAME.md
- PHASE_X_OVERVIEW.md
- PHASE_X_IMPLEMENTATION.md

Stage numbers are globally incremental.

---

## 🔐 SECURITY RULES

- All routes must validate JWT
- Role check required for protected endpoints
- Subscription check required before exam start
- Submission must be idempotent
- Never trust client time

---

## 🧪 TESTING REQUIREMENTS

Minimum enforcement:

- Unit test for grading logic
- Integration test for submission
- Load test for scheduled exams
- Permission test for role boundaries

PR cannot merge without:

- Tests passing
- Lint passing

---

## 🧱 GIT WORKFLOW

Branch naming:

feature/stage-XX-short-name  
fix/stage-XX-bug  
refactor/stage-XX

Pull Request must include:

- Stage reference
- What changed
- Migration notes (if any)
- Breaking changes (if any)

---

## 🔄 DATABASE MIGRATION RULE

- No manual DB edits
- All schema changes via migration files
- Migration must be versioned
- Migration must be reversible

---

## 📈 PERFORMANCE BASELINE

- Index foreign keys
- Avoid N+1 queries
- Avoid heavy joins in dashboards
- Use pagination for all lists

---

## 🚫 FORBIDDEN PRACTICES

- Business logic inside controllers
- Hard-coded division filtering
- Inline SQL in frontend
- Skipping subscription enforcement
- Skipping role validation

---

## 📦 CODE REVIEW CHECKLIST

Reviewer must verify:

- Layering respected
- No cross-tenant leakage
- Idempotency handled
- Rate limiting applied
- Proper indexing

---

## 📌 FINAL PRINCIPLE

Zidney is:

- White-label SaaS
- Multi-tenant isolated
- Exam-centric
- Institutional-grade

Shortcuts destroy trust.

Architecture discipline is mandatory.
