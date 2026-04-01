# PR Summary — STAGE_35_TRADITIONAL_QUESTION_MODEL

## Purpose

Add support for the Traditional Question Model in the Backoffice and Exam Engine. This PR implements domain model, migrations, API routes, validation schemas, and service logic.

## Changes

- Domain: `packages/domain-core/src/traditional-questions/` — types, errors, repository, service
- API: `apps/api/src/routes/backoffice/traditional-questions/` — CRUD, link/unlink category/tag, list filters
- DB migrations: `apps/api/src/db/{tenant,master}/migrations/` — create `traditional_questions` table and indexes
- Validation: `packages/validation` — backoffice schemas for create/update/list
- Tests: unit and integration tests for service and routes

## How to test locally

Follow the steps in `specs/runtime/035-traditional-question-model/guides/TESTING_GUIDE.md`.

## Notes for reviewers

- Please review the migrations and confirm they are forward-only and idempotent.
- Verify that `correct_answer` is nullable and `lesson_id` index/filter works as expected.
- Confirm immutability guards for `subsectionId` and `subject` fields.

## Related artifacts

- Spec: `specs/runtime/035-traditional-question-model/spec.md`
- Plan: `specs/runtime/035-traditional-question-model/plan.md`
- Tasks: `specs/runtime/035-traditional-question-model/tasks.md`
