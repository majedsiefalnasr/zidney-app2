# Data Model: Test Fixtures and Seeding Strategy

**Stage**: STAGE_TEST_01_PLATFORM_FOUNDATION  
**Branch**: test-001-platform-foundation  
**Date**: 2026-02-26  
**Phase**: Phase 1 — Design Artifacts

---

## Overview

This document defines test data structures, relationships, seeding scripts, and idempotency markers
required for the 31-test validation suite.

---

## Core Entities and Relationships

### Entity Relationship Diagram

```
master_db:
  workspaces (1) ──────── (1) licenses
  workspaces (1) ──────── (N) subscriptions

tenant_db (per workspace):
  users (1) ──────── (N) roles
  roles (1) ──────── (N) permissions
  students (1) ──────── (N) attempts
  attempts (1) ──────── (N) submissions
  submissions (1) ──←── questions_snapshot
  schema_version (singleton)
```

---

## Master Database Fixtures

### 1. Workspace

**Table**: `workspaces`

```typescript
interface WorkspaceFixture {
  id: string; // UUID
  slug: string; // URL-safe identifier, immutable
  name: string; // Display name, mutable
  owner_id: string; // Reference to owner user
  created_at: Date;
  updated_at: Date;
}

// Test fixture factory
function createWorkspaceFixture(overrides?: Partial<WorkspaceFixture>): WorkspaceFixture {
  return {
    id: randomUUID(),
    slug: `test-${randomUUID().slice(0, 8)}`,
    name: "Test Workspace",
    owner_id: randomUUID(),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// Seeding script
async function seedWorkspace(masterDb: Database, overrides?: Partial<WorkspaceFixture>) {
  const fixture = createWorkspaceFixture(overrides);
  const [workspace] = await masterDb.insert(workspaces).values(fixture).returning();
  return workspace;
}
```

**Test Usage**:

```typescript
// Test 1.1: Cross-tenant access
const wsA = await seedWorkspace(masterDb, { slug: "workspace-a" });
const wsB = await seedWorkspace(masterDb, { slug: "workspace-b" });
```

---

### 2. License

**Table**: `licenses`

```typescript
interface LicenseFixture {
  id: string; // UUID
  workspace_id: string; // FK to workspaces
  product_id: string; // Product identifier
  status: "ACTIVE" | "SOFT_LOCKED" | "ARCHIVED" | "DELETED";
  max_students: number; // Limit
  max_staff: number; // Limit
  active_from: Date;
  active_until: Date | null; // null = indefinite
  created_at: Date;
  updated_at: Date;
}

function createLicenseFixture(overrides?: Partial<LicenseFixture>): LicenseFixture {
  return {
    id: randomUUID(),
    workspace_id: randomUUID(),
    product_id: "product-v2.0.0",
    status: "ACTIVE",
    max_students: 1000,
    max_staff: 50,
    active_from: new Date(),
    active_until: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

async function seedLicense(masterDb: Database, overrides?: Partial<LicenseFixture>) {
  const fixture = createLicenseFixture(overrides);
  const [license] = await masterDb.insert(licenses).values(fixture).returning();
  return license;
}
```

**Test Usage**:

```typescript
// Test 3.1a: Valid transition ACTIVE -> SOFT_LOCKED
const license = await seedLicense(masterDb, {
  workspace_id: wsA.id,
  status: "ACTIVE",
});

// Test 3.3a: Student limit enforcement
const licenseWithLimit = await seedLicense(masterDb, {
  workspace_id: wsA.id,
  max_students: 100,
});
```

---

## Tenant Database Fixtures

### 3. User (Platform User)

**Table**: `users` (in tenant database)

```typescript
interface UserFixture {
  id: string; // UUID
  workspace_id: string; // FK to workspaces (implicit in tenant DB)
  email: string; // Unique within workspace
  password_hash: string; // bcrypt hash
  first_name: string;
  last_name: string;
  role: "ADMIN" | "INSTRUCTOR" | "STUDENT" | "STAFF";
  created_at: Date;
  updated_at: Date;
}

function createUserFixture(overrides?: Partial<UserFixture>): UserFixture {
  const randomId = randomUUID().slice(0, 8);
  return {
    id: randomUUID(),
    workspace_id: randomUUID(),
    email: `user-${randomId}@test.local`,
    password_hash: await hash("password123"), // bcrypt
    first_name: "Test",
    last_name: "User",
    role: "STUDENT",
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

async function seedUser(tenantDb: Database, overrides?: Partial<UserFixture>) {
  const fixture = createUserFixture(overrides);
  const [user] = await tenantDb.insert(users).values(fixture).returning();
  return user;
}
```

**Test Usage**:

```typescript
// Test 1.1: Cross-tenant user
const userA = await seedUser(tenantDbA, { role: "STUDENT" });
const userB = await seedUser(tenantDbB, { role: "STUDENT" });

// Test 7.3: Server-authoritative time
const student = await seedUser(tenantDb, { role: "STUDENT" });
```

---

### 4. Student

**Table**: `students` (in tenant database)

```typescript
interface StudentFixture {
  id: string; // UUID
  workspace_id: string; // FK (implicit in tenant DB)
  user_id: string; // FK to users (if linked)
  email: string; // Enrollment email
  enrollment_id: string; // Unique identifier (e.g., "S001")
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  grade: string | null; // Current grade
  created_at: Date;
  updated_at: Date;
}

function createStudentFixture(overrides?: Partial<StudentFixture>): StudentFixture {
  const idx = Math.floor(Math.random() * 10000);
  return {
    id: randomUUID(),
    workspace_id: randomUUID(),
    user_id: null, // Optional
    email: `student-${idx}@test.local`,
    enrollment_id: `ENR-${idx.toString().padStart(5, "0")}`,
    status: "ACTIVE",
    grade: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

async function seedStudent(
  tenantDb: Database,
  count: number = 1,
  overrides?: Partial<StudentFixture>,
) {
  const fixtures = Array(count)
    .fill(0)
    .map(() => createStudentFixture(overrides));

  const students = await tenantDb.insert(students).values(fixtures).returning();
  return students;
}
```

**Test Usage**:

```typescript
// Test 3.3a: Student limit enforcement (create exactly 100)
const students = await seedStudent(tenantDb, 100, { status: "ACTIVE" });

// Test 2.3: Schema verification (verify students table exists)
const studentCount = await tenantDb.select(sql`count(*)`).from(students);
```

---

### 5. Attempt

**Table**: `attempts` (in tenant database)

```typescript
interface AttemptFixture {
  id: string; // UUID
  workspace_id: string; // FK (implicit)
  student_id: string; // FK to students
  exam_id: string; // FK to exams (Phase 02)
  status: "PENDING" | "IN_PROGRESS" | "SUBMITTED" | "GRADED" | "EXPIRED";
  started_at: Date;
  deadline_at: Date | null;
  submitted_at: Date | null;
  final_score: number | null;
  snapshot_config: string; // JSON stringified snapshot
  created_at: Date;
  updated_at: Date;
}

function createAttemptFixture(overrides?: Partial<AttemptFixture>): AttemptFixture {
  const startedAt = new Date();
  const deadlineAt = new Date(startedAt.getTime() + 60 * 60 * 1000); // 60 min

  return {
    id: randomUUID(),
    workspace_id: randomUUID(),
    student_id: randomUUID(),
    exam_id: randomUUID(),
    status: "IN_PROGRESS",
    started_at: startedAt,
    deadline_at: deadlineAt,
    submitted_at: null,
    final_score: null,
    snapshot_config: JSON.stringify({
      exam_id: "",
      exam_title: "Test Exam",
      total_points: 100,
      pass_threshold: 60,
      passing_grade: "D",
      time_limit_minutes: 60,
      questions: [],
    }),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

async function seedAttempt(tenantDb: Database, overrides?: Partial<AttemptFixture>) {
  const fixture = createAttemptFixture(overrides);
  const [attempt] = await tenantDb.insert(attempts).values(fixture).returning();
  return attempt;
}
```

**Test Usage**:

```typescript
// Test 7.1: Snapshot immutability
const exam = await seedExam(tenantDb);
const attempt = await seedAttempt(tenantDb, { exam_id: exam.id });

// Test 7.3: Server-authoritative time
const nowAttempt = await seedAttempt(tenantDb, {
  started_at: new Date(),
  deadline_at: new Date(Date.now() + 60000),
});
```

---

### 6. Submission

**Table**: `submissions` (in tenant database)

```typescript
interface SubmissionFixture {
  id: string; // UUID
  workspace_id: string; // FK (implicit)
  attempt_id: string; // FK to attempts
  question_id: string; // FK to questions_snapshot
  answer_data: string; // JSON stringified answer
  score: number | null; // Populated by Worker (initially null)
  submitted_at: Date;
  created_at: Date;
  updated_at: Date;
}

function createSubmissionFixture(overrides?: Partial<SubmissionFixture>): SubmissionFixture {
  return {
    id: randomUUID(),
    workspace_id: randomUUID(),
    attempt_id: randomUUID(),
    question_id: randomUUID(),
    answer_data: JSON.stringify({ type: "mcq", choice: "A" }),
    score: null, // Graded by Worker
    submitted_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

async function seedSubmission(tenantDb: Database, overrides?: Partial<SubmissionFixture>) {
  const fixture = createSubmissionFixture(overrides);
  const [submission] = await tenantDb.insert(submissions).values(fixture).returning();
  return submission;
}
```

**Test Usage**:

```typescript
// Test 7.2: Worker-only grading
const submission = await seedSubmission(tenantDb, {
  attempt_id: attempt.id,
  score: null, // Initially null, populated by Worker
});

// Verify submission was stored without score
expect(submission.score).toBeNull();
```

---

### 7. Questions Snapshot

**Table**: `questions_snapshot` (in tenant database)

```typescript
interface QuestionSnapshot {
  id: string; // UUID
  workspace_id: string; // FK (implicit)
  attempt_id: string; // FK to attempts
  question_id_original: string; // Original question ID from exam
  question_data: string; // JSON stringified question
  order_in_attempt: number; // Position in attempt
  created_at: Date;
}

function createQuestionSnapshotFixture(overrides?: Partial<QuestionSnapshot>): QuestionSnapshot {
  return {
    id: randomUUID(),
    workspace_id: randomUUID(),
    attempt_id: randomUUID(),
    question_id_original: randomUUID(),
    question_data: JSON.stringify({
      id: "",
      title: "Sample Question",
      type: "MCQ",
      points: 20,
      content: "What is 2+2?",
      options: ["3", "4", "5"],
      correct_answer: "4",
    }),
    order_in_attempt: 1,
    created_at: new Date(),
    ...overrides,
  };
}

async function seedQuestionSnapshot(tenantDb: Database, overrides?: Partial<QuestionSnapshot>) {
  const fixture = createQuestionSnapshotFixture(overrides);
  const [snapshot] = await tenantDb.insert(questionsSnapshot).values(fixture).returning();
  return snapshot;
}
```

**Test Usage**:

```typescript
// Test 7.1: Snapshot immutability verification
const snapshots = await seedQuestionSnapshot(tenantDb, {
  attempt_id: attempt.id,
  order_in_attempt: 1,
});
```

---

### 8. Schema Version

**Table**: `schema_version` (in tenant database)

```typescript
interface SchemaVersionRecord {
  version: string; // Semantic version (e.g., "2.0.0")
  applied_at: Date;
}

// Seeded automatically during provisioning
async function verifySchemaVersion(tenantDb: Database, expectedVersion: string) {
  const [record] = await tenantDb.select().from(schemaVersion).limit(1);

  expect(record.version).toBe(expectedVersion);
  expect(record.applied_at).toBeDefined();
}
```

**Test Usage**:

```typescript
// Test 3.2: Version enforcement
const currentVersion = await verifySchemaVersion(tenantDb, "2.0.0");

// Test 4.2: Simulate schema drift
await tenantDb.update(schemaVersion).set({ version: "1.9.0" });
```

---

## Seeding Strategy

### Setup Pattern

```typescript
// Complete test setup with all prerequisites
async function setupCompleteTestEnvironment(): Promise<TestEnvironment> {
  // 1. Create master DB records
  const workspace = await seedWorkspace(masterDb, { slug: "test-ws-1" });
  const license = await seedLicense(masterDb, {
    workspace_id: workspace.id,
    status: "ACTIVE",
    max_students: 100,
  });

  // 2. Trigger provisioning (creates tenant database)
  await provisioningService.provision(workspace.id);

  // 3. Get tenant database connection
  const tenantDb = await getTenantPool(workspace.id).getConnection();

  // 4. Create tenant records
  const user = await seedUser(tenantDb, {
    workspace_id: workspace.id,
  });
  const students = await seedStudent(tenantDb, 50, {
    workspace_id: workspace.id,
  });
  const attempt = await seedAttempt(tenantDb, {
    workspace_id: workspace.id,
    student_id: students[0].id,
  });

  return {
    workspace,
    license,
    tenantDb,
    user,
    students,
    attempt,
  };
}
```

### Teardown Pattern

```typescript
// Clean up test data
async function teardownTestEnvironment(env: TestEnvironment) {
  // Drop entire tenant database (cleanest isolation)
  await adminDb.query(`DROP DATABASE IF EXISTS "${env.workspace.slug}_tenant_db"`);

  // Delete master records
  await masterDb.delete(licenses).where(eq(licenses.id, env.license.id));
  await masterDb.delete(workspaces).where(eq(workspaces.id, env.workspace.id));
}
```

---

## Idempotency Markers

### Test Data Naming Convention

```typescript
// Each test gets isolated data using test-specific prefixes
const testId = `test-${Date.now()}-${randomUUID().slice(0, 8)}`;

const workspace = await seedWorkspace(masterDb, {
  slug: `${testId}-ws`,
  name: `Test Workspace [${testId}]`,
});
const license = await seedLicense(masterDb, {
  id: `${testId}-lic`,
  workspace_id: workspace.id,
});
const student = await seedStudent(tenantDb, 1, {
  email: `${testId}@test.local`,
});
```

### Idempotent Seeding

```typescript
// If test reruns, seeding should detect existing data
async function seedWorkspaceIdempotent(masterDb: Database, testId: string): Promise<Workspace> {
  // Check if workspace already exists
  const existing = await masterDb
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, `${testId}-ws`))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Create new
  return seedWorkspace(masterDb, { slug: `${testId}-ws` });
}
```

**Usage**:

```typescript
// Test can be rerun safely; seeding is idempotent
const testId = "test-123";
const workspace = await seedWorkspaceIdempotent(masterDb, testId);
```

---

## Test Data Lifecycle

### Timeline for Single Test

```
1. SETUP (beforeEach):
   - Create unique testId
   - Seed master workspace + license
   - Provision tenant database
   - Seed tenant records (users, students, exams)
   - Return test environment

2. TEST EXECUTION:
   - Use environment data in test
   - Make API calls or direct DB queries
   - Assert expectations

3. TEARDOWN (afterEach):
   - Delete tenant database
   - Delete master records
   - Release connections
   - Reset mocks/spies
```

### Multi-Workspace Scenarios

```typescript
// Tests 1.1-1.4 require 2 workspaces
async function setupMultiWorkspaceTest(): Promise<MultiWorkspaceEnvironment> {
  const testId = generateTestId();

  // Workspace A
  const wsA = await seedWorkspace(masterDb, { slug: `${testId}-ws-a` });
  const licA = await seedLicense(masterDb, { workspace_id: wsA.id });
  await provisioningService.provision(wsA.id);
  const tenantDbA = await getTenantPool(wsA.id).getConnection();
  const userA = await seedUser(tenantDbA, { workspace_id: wsA.id });

  // Workspace B
  const wsB = await seedWorkspace(masterDb, { slug: `${testId}-ws-b` });
  const licB = await seedLicense(masterDb, { workspace_id: wsB.id });
  await provisioningService.provision(wsB.id);
  const tenantDbB = await getTenantPool(wsB.id).getConnection();
  const userB = await seedUser(tenantDbB, { workspace_id: wsB.id });

  return { wsA, tenantDbA, userA, wsB, tenantDbB, userB };
}
```

---

## Bulk Seeding for Performance Tests

### Bulk Student Creation (Test 3.3a)

```typescript
// Seed 100 students efficiently
async function seedStudentsBulk(tenantDb: Database, count: number) {
  const fixtures = Array(count)
    .fill(0)
    .map((_, idx) => ({
      id: randomUUID(),
      workspace_id: tenantDb.getWorkspaceId(),
      email: `student-${idx}@test.local`,
      enrollment_id: `ENR-${idx.toString().padStart(5, "0")}`,
      status: "ACTIVE" as const,
      grade: null,
      created_at: new Date(),
      updated_at: new Date(),
    }));

  // Insert in single query
  const students = await tenantDb.insert(students).values(fixtures).returning();

  return students;
}

// Usage in test
it("Test 3.3a: Student limit enforcement", async () => {
  const students = await seedStudentsBulk(tenantDb, 100);
  expect(students.length).toBe(100);

  // Attempt 101st
  const excess = await client.post(`/api/workspaces/${wsId}/students`, {
    email: "over-limit@test.local",
  });
  expect(excess.status).toBe(409);
});
```

---

## Test Data Volume Reference

| Entity         | Unit Tests | Integration | Performance |
| -------------- | ---------- | ----------- | ----------- |
| Workspaces     | 2-5        | 2-5         | 100+        |
| Licenses       | 10-20      | 10-20       | 1000+       |
| Users/Students | 10-50      | 50-100      | 10,000+     |
| Attempts       | 5-10       | 10-50       | 1000+       |
| Submissions    | 5-10       | 10-50       | 10,000+     |

---

## Schema Assumptions

### Tables Required (from Phase 01)

- ✅ workspaces
- ✅ licenses
- ✅ users
- ✅ roles
- ✅ permissions
- ✅ students
- ✅ staff
- ✅ attempts
- ✅ submissions
- ✅ questions_snapshot
- ✅ schema_version

### Tables Required (from Phase 02 - assumed complete for Phase 01 tests)

- ✅ exams
- ✅ questions
- ✅ grading_rules

### Dependencies

If Phase 02 schema not available, Tests 7.1-7.3 (Attempt Engine) cannot run.

---

## Summary

**Seeding Artifacts Created**: ✅

- 8 core entity fixtures
- Setup and teardown patterns
- Idempotency markers
- Bulk seeding utilities
- Multi-workspace scenarios

**Ready for Phase 1: Contracts** ✅
