# TypeScript Type Safety Governance - Data Models & Schemas

**Document Purpose**: Formal specification of all data structures, schemas, registries, and validation models used in the Type Safety Governance system.

**Date**: 2026-03-11  
**Version**: 1.0.0

---

## Section 1: ALLOWED_ANY_EXCEPTIONS.json Registry

### 1.1 Registry Purpose & Scope

The `ALLOWED_ANY_EXCEPTIONS.json` registry is a whitelist of approved exceptions to type safety rules. Each entry documents:

- **Where** the exception exists (file path + line number)
- **Why** it was approved (business justification)
- **Who** approved it (accountability)
- **Until when** it's valid (sunset clause)
- **Status** (active, expired, resolved)

**Registry Locations**:

- `packages/domain-core/ALLOWED_ANY_EXCEPTIONS.json`
- `packages/types/ALLOWED_ANY_EXCEPTIONS.json`
- `packages/validation/ALLOWED_ANY_EXCEPTIONS.json`

Each protected package maintains its own registry for ownership clarity.

### 1.2 Complete Registry Schema

```typescript
interface AllowedAnyExceptionsRegistry {
  // Registry metadata
  version: string;
  // Semantic version (e.g., "1.0.0")

  lastUpdated: ISO8601String;
  // ISO8601 timestamp of last modification
  // Format: "2026-03-11T15:30:45.123Z"

  maintainer: string;
  // Contact for questions about exceptions (e.g., "team-platform")

  exceptions: ExceptionEntry[];
  // Array of approved exceptions
}

interface ExceptionEntry {
  // Unique identifier within registry
  id: string;
  // Format: "legacy-001" or "external-sdk-001"
  // Used to track exceptions across commits

  // Location of violation
  file: string;
  // Relative path from package root
  // Example: "src/models/legacy-exam.ts"

  line: number;
  // Line number of violation (1-indexed)
  // Example: 42

  column?: number;
  // Optional: column number for precision
  // Example: 15

  // Type of unsafe pattern
  pattern: "implicit-any" | "explicit-any" | "any-assertion" | "ts-ignore";
  // implicit-any: No type specified (inferred as any)
  // explicit-any: "const x: any"
  // any-assertion: "const x = y as any"
  // ts-ignore: "// @ts-ignore" comment

  // Justification & approval
  reason: string;
  // Detailed business justification (2-3 sentences)
  // Example:
  // "Legacy code predates type safety governance; refactor planned for Q2 2026.
  //  Tracked as issue #456. Do not extend beyond sunset date."

  issueLink?: string;
  // Optional: URL to GitHub issue for tracking
  // Example: "https://github.com/org/repo/issues/456"

  approver: string;
  // Who approved exception (team or individual)
  // Example: "team-architecture" or "@alice"

  // Timestamps
  addedDate: ISO8601String;
  // When exception was added (ISO8601)
  // Example: "2026-03-10T14:30:00Z"

  sunsetDate: ISO8601String | null;
  // When exception expires and must be remediated
  // null = no expiration (for permanent third-party limitations)
  // Example: "2026-09-10T23:59:59Z"

  // Status tracking
  status: "active" | "expired" | "resolved";
  // active: Exception is currently valid
  // expired: Sunset date passed; requires renewal or fix
  // resolved: Issue was fixed; PR merged; can archive

  resolvedInPR?: string;
  // If status === 'resolved': URL to PR that fixed issue
  // Example: "https://github.com/org/repo/pull/1234"

  notes?: string;
  // Additional context (optional)
  // Example: "Waiting for ExternalLib v2.5.0 to add types"
}
```

### 1.3 Valid Example Registry

**File**: `packages/domain-core/ALLOWED_ANY_EXCEPTIONS.json`

```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-03-11T15:30:45.123Z",
  "maintainer": "team-platform",
  "exceptions": [
    {
      "id": "legacy-001",
      "file": "src/models/legacy-exam-runner.ts",
      "line": 42,
      "column": 15,
      "pattern": "explicit-any",
      "reason": "Legacy code predates type safety governance (2023). Refactor planned for Q2 2026 (issue #456). Does not affect new exam engine code.",
      "issueLink": "https://github.com/zidney/app/issues/456",
      "approver": "team-architecture",
      "addedDate": "2026-03-10T14:30:00Z",
      "sunsetDate": "2026-09-10T23:59:59Z",
      "status": "active",
      "notes": "Estimated 8 hours to refactor; blockedby: other refactors"
    },
    {
      "id": "sdk-external-001",
      "file": "src/integrations/auth-service.ts",
      "line": 77,
      "pattern": "ts-ignore",
      "reason": "AuthSDK@1.2.0 has incomplete type definitions. Official types in progress (https://github.com/authsdk/repo/issues/123). Expected in v2.0.0 (Q3 2026).",
      "issueLink": "https://github.com/authsdk/repo/issues/123",
      "approver": "team-external-integrations",
      "addedDate": "2025-12-01T10:00:00Z",
      "sunsetDate": null,
      "status": "active",
      "notes": "Public API is stable; only types are missing. Safe to import despite type error."
    },
    {
      "id": "api-client-001",
      "file": "src/api/responses.ts",
      "line": 88,
      "pattern": "any-assertion",
      "reason": "Dynamic API response structure (third-party REST API returns varied object types). Validation layer (packages/validation) handles runtime types.",
      "approver": "team-platform",
      "addedDate": "2026-01-15T09:00:00Z",
      "sunsetDate": "2026-08-15T23:59:59Z",
      "status": "active",
      "notes": "Waiting for API provider to document schema; estimated Q2 completion."
    },
    {
      "id": "legacy-002",
      "file": "src/models/old-grading.ts",
      "line": 120,
      "pattern": "implicit-any",
      "reason": "Function parameter typing deferred pending architecture review (ADR pending). Once ADR approved, refactor will add types.",
      "issueLink": "https://github.com/zidney/app/issues/789",
      "approver": "team-architecture",
      "addedDate": "2026-02-01T11:00:00Z",
      "sunsetDate": "2026-05-01T23:59:59Z",
      "status": "active"
    },
    {
      "id": "sdk-external-002",
      "file": "src/integrations/analytics.ts",
      "line": 45,
      "pattern": "explicit-any",
      "reason": "AnalyticsSDK@3.1.0 exports only untyped JavaScript. Types cannot be added without SDK update. Approved for indefinite use with validation at call sites.",
      "approver": "team-analytics",
      "addedDate": "2026-03-01T13:00:00Z",
      "sunsetDate": null,
      "status": "active",
      "notes": "SDK maintainer confirmed types are not planned; this is permanent exception."
    }
  ]
}
```

### 1.4 Schema Validation Rules

```typescript
// Validation constraints for exception entries:

1. id must be unique within registry
   // Cannot have two entries with same id

2. file path must be relative and use forward slashes
   // ✅ "src/models/user.ts"
   // ❌ "src\models\user.ts" (backslashes)
   // ❌ "/src/models/user.ts" (leading slash)
   // ❌ "../other/file.ts" (relative traversal)

3. line must be positive integer >= 1
   // ✅ 42
   // ❌ 0, -1, "42", 3.14

4. pattern must be one of four allowed values
   // ✅ "implicit-any" | "explicit-any" | "any-assertion" | "ts-ignore"
   // ❌ "unsafe-cast", "untyped", etc.

5. reason must be 2-3 sentences (50-300 characters)
   // Too short: "legacy" (rejected)
   // Too long: [500 chars] (warning, but allowed)

6. approver must reference person or team
   // ✅ "team-platform", "@alice", "alice@company.com"
   // ❌ "approved", "yes"

7. addedDate must be valid ISO8601 timestamp
   // ✅ "2026-03-11T15:30:45.123Z"
   // ❌ "2026-03-11", "03/11/2026", "today"

8. sunsetDate must be:
   - null (no expiration), OR
   - valid ISO8601 timestamp > addedDate
   // ✅ null
   // ✅ "2026-09-11T23:59:59Z" (6 months later)
   // ❌ "2026-03-10T00:00:00Z" (before addedDate)

9. status must be one of three values
   // ✅ "active" | "expired" | "resolved"
   // ❌ "pending", "archived"

10. If status === "resolved", resolvedInPR must be present
    // ✅ { "status": "resolved", "resolvedInPR": "https://..." }
    // ❌ { "status": "resolved" } (missing PR)

11. If status === "expired", entry should be archived/removed
    // Action: Update status or fix underlying issue
```

---

## Section 2: Type Safety Guard Script Output Format

### 2.1 JSON Output Format

**Invocation**: `bun type-safety-guard --json`

**Output Schema**:

```typescript
interface GuardScriptOutput {
  // Metadata
  metadata: {
    version: string;
    // Script version (e.g., "1.0.0")

    executedAt: ISO8601String;
    // Timestamp when scan began

    executionTimeMs: number;
    // How long scan took in milliseconds

    scanScope: string;
    // What was scanned (e.g., "full-monorepo", "protected-packages-only")
  };

  summary: {
    totalFiles: number;
    // Total TypeScript files scanned

    totalViolations: number;
    // Total violations detected (across all files)

    errorCount: number;
    // Violations classified as errors (must fix)

    warningCount: number;
    // Violations classified as warnings (should fix)

    allowListedCount: number;
    // Violations that are allowed

    expiredExceptionCount: number;
    // Exceptions past their sunset date

    passedFiles: number;
    // Files with no violations

    failedFiles: number;
    // Files with violations
  };

  results: ViolationResult[];
}

interface ViolationResult {
  // File location
  file: string;
  // Absolute path to file

  line: number;
  // Line number (1-indexed)

  column: number;
  // Column number (1-indexed)

  // Violation details
  pattern: "implicit-any" | "explicit-any" | "any-assertion" | "ts-ignore";
  // Type of unsafe pattern detected

  code: string;
  // The actual code snippet (up to 80 chars)

  severity: "error" | "warning";
  // error = must fix before merge
  // warning = should fix

  message: string;
  // Human-readable violation description

  suggestion: string;
  // Recommended fix

  // Allow-list status
  allowListed: boolean;
  // true if in ALLOWED_ANY_EXCEPTIONS.json

  exceptionId?: string;
  // ID of exception if allow-listed

  exceptionExpires?: ISO8601String;
  // When exception expires (if has sunset date)

  exceptionExpired?: boolean;
  // true if sunset date has passed
}

type ScanScope = "full-monorepo" | "protected-packages-only" | "changed-files-only";
```

**Example JSON Output**:

```json
{
  "metadata": {
    "version": "1.0.0",
    "executedAt": "2026-03-11T15:35:22.456Z",
    "executionTimeMs": 8234,
    "scanScope": "changed-files-only"
  },
  "summary": {
    "totalFiles": 45,
    "totalViolations": 12,
    "errorCount": 3,
    "warningCount": 9,
    "allowListedCount": 2,
    "expiredExceptionCount": 0,
    "passedFiles": 42,
    "failedFiles": 3
  },
  "results": [
    {
      "file": "/home/user/zidney/packages/api-client/src/models.ts",
      "line": 42,
      "column": 15,
      "pattern": "explicit-any",
      "code": "const data: any = apiResponse;",
      "severity": "error",
      "message": "Explicit 'any' type found without justification",
      "suggestion": "Use 'unknown' type and validate with schema; or add 'biome-ignore' comment with reason",
      "allowListed": false,
      "exceptionId": null,
      "exceptionExpires": null,
      "exceptionExpired": false
    },
    {
      "file": "/home/user/zidney/packages/domain-core/src/exam-runner.ts",
      "line": 88,
      "column": 8,
      "pattern": "ts-ignore",
      "code": "// @ts-ignore",
      "severity": "error",
      "message": "@ts-ignore comment without justification",
      "suggestion": "Add comment explaining why type error is suppressed; or fix underlying type error",
      "allowListed": false,
      "exceptionId": null,
      "exceptionExpires": null,
      "exceptionExpired": false
    },
    {
      "file": "/home/user/zidney/packages/domain-core/src/integration.ts",
      "line": 156,
      "column": 22,
      "pattern": "any-assertion",
      "code": "const result = response as any;",
      "severity": "warning",
      "message": "Type assertion to 'any' without justification",
      "suggestion": "Type the response explicitly; use 'unknown' and validate if external data",
      "allowListed": true,
      "exceptionId": "sdk-external-001",
      "exceptionExpires": null,
      "exceptionExpired": false
    }
  ]
}
```

### 2.2 Markdown Output Format

**Invocation**: `bun type-safety-guard` (default)

**Output Example**:

````markdown
# Type Safety Violations Report

**Generated**: 2026-03-11 at 15:35:22 UTC  
**Scan Scope**: changed-files-only  
**Execution Time**: 8.234 seconds

## Summary

| Metric                    | Count |
| ------------------------- | ----- |
| Total Files Scanned       | 45    |
| Total Violations          | 12    |
| **Errors** (must fix)     | 3     |
| **Warnings** (should fix) | 9     |
| Allow-listed Violations   | 2     |
| Expired Exceptions        | 0     |
| Files with Issues         | 3     |
| Files with No Issues      | 42    |

**Status**: ❌ **FAILED** — 3 errors must be fixed before merge

---

## Errors (3 total) — MUST FIX BY MERGE

### 1. packages/api-client/src/models.ts:42

```typescript
const data: any = apiResponse;
```
````

- **Pattern**: explicit-any
- **Problem**: Unsafe 'any' type without justification
- **Fix**: Use 'unknown' and validate, or add biome-ignore comment with reason
- **Allowed**: No

---

### 2. packages/domain-core/src/exam-runner.ts:88

```typescript
// @ts-ignore
```

- **Pattern**: ts-ignore
- **Problem**: Type suppression without documented reason
- **Fix**: Add comment explaining why this is necessary, or fix the underlying type error
- **Allowed**: No

---

## Warnings (9 total) — SHOULD FIX

### 1. packages/types/src/index.ts:15

```typescript
function processData(input: any): any {
```

- **Pattern**: implicit-any
- **Problem**: Parameter and return types inferred as any
- **Fix**: Add explicit parameter and return types
- **Allowed**: No

---

### 2. packages/domain-core/src/integration.ts:156

```typescript
const result = response as any;
```

- **Pattern**: any-assertion
- **Problem**: Type assertion to 'any' without justification
- **Fix**: Type explicitly, or validate if external data
- **Allowed**: ✅ Yes (exception: sdk-external-001, added 2025-12-01)

---

## Remediation Guide

For each violation:

1. **Read the problem** — Understand what the issue is
2. **Choose a fix**:
   - Option A: Fix the type error (preferred)
   - Option B: Add `biome-ignore` comment with justification (for legitimate cases)
   - Option C: Request exception (for third-party limitations)
3. **Test locally**: `bun type-safety-guard --json` to verify fix
4. **Commit and push**: CI will re-run validation

See [Type Safety Rules Handbook](../docs/type-safety/type-safety-rules-handbook.md) for detailed patterns.

---

## CI Integration

This report is generated by `scripts/type-safety-guard.ts` as part of:

```bash
bun typecheck          # Step 1: TypeScript compiler check
bun type-safety-guard  # Step 2: Custom pattern detection (this report)
biome lint             # Step 3: Linting
```

**All steps must pass for PR to merge.**

---

**Exit Code**: 1 (failure)  
**Next Step**: Fix violations and re-run validation

````

---

## Section 3: Validation Schema Patterns

### 3.1 External Data Validation Pattern Registry

**Location**: `packages/validation/VALIDATION_PATTERNS.md`

**Purpose**: Catalog reusable validation patterns for common data types

#### Pattern 1: API Response Validation

```typescript
// File: packages/validation/src/schemas/api-response.schema.ts

import { z } from 'zod'; // or equivalent validation library

// Define schema for external API response
export const UserResponseSchema = z.object({
  id: z.string().uuid().describe('User unique identifier'),
  email: z.string().email().describe('User email address'),
  name: z.string().min(1).describe('User full name'),
  createdAt: z.string().datetime().describe('Account creation timestamp'),

  // Optional fields must be explicit
  phoneNumber: z.string().optional().describe('User phone (optional)'),
  avatar: z.string().url().optional().describe('Profile avatar URL (optional)'),
});

// Infer TypeScript type from schema
export type UserResponse = z.infer<typeof UserResponseSchema>;

// Usage in handler
export async function getUser(id: UserId): Promise<User> {
  // Step 1: Get external data (typed as unknown)
  const raw: unknown = await fetch(`https://api/users/${id}`).then(r => r.json());

  // Step 2: Validate against schema (unknown → validated type)
  const validated = UserResponseSchema.parse(raw);

  // Step 3: Type is now guaranteed safe; use in domain logic
  return mapExternalUserToModel(validated);
}
````

**Validation Flow**:

```
Promise<unknown> ──validate──> Promise<UserResponse> ──map──> Promise<User>
   untrusted            schema        validated              domain
```

#### Pattern 2: Database Query Result Validation

```typescript
// File: packages/validation/src/schemas/db-result.schema.ts

export const ExamResultSchema = z.object({
  id: z.string().uuid(),
  examId: z.string().uuid(),
  studentId: z.string().uuid(),
  score: z.number().int().min(0).max(100),
  submittedAt: z.coerce.date(), // Convert timestamp to Date
  graded: z.boolean(),
  gradedAt: z.coerce.date().nullable(),
});

export type ExamResultRow = z.infer<typeof ExamResultSchema>;

// Usage in repository
export async function getExamResults(examId: ExamId): Promise<ExamResult[]> {
  // Query returns unknown rows
  const rows: unknown[] = await db.query("SELECT * FROM exam_results WHERE exam_id = ?", [examId]);

  // Validate each row
  const validated = rows.map((row) => ExamResultSchema.parse(row));

  // Now safe to use in domain logic
  return validated.map(mapRowToModel);
}
```

#### Pattern 3: Message Queue Validation

```typescript
// File: packages/validation/src/schemas/queue-message.schema.ts

export const ExamSubmissionEventSchema = z.object({
  eventId: z.string().uuid().describe("Unique event identifier"),
  attemptId: z.string().uuid().describe("Parent attempt"),
  studentId: z.string().uuid().describe("Student who submitted"),
  submittedAt: z.number().describe("Unix timestamp in milliseconds"),

  answers: z.record(
    z.string(), // question IDs
    z.unknown(), // answers can be various types; validation deferred
  ),

  metadata: z
    .object({
      userAgent: z.string().optional(),
      ipAddress: z.string().optional(),
    })
    .optional(),
});

export type ExamSubmissionEvent = z.infer<typeof ExamSubmissionEventSchema>;

// Usage in queue consumer
export async function handleExamSubmission(message: unknown): Promise<void> {
  // Step 1: Validate message structure
  const event = ExamSubmissionEventSchema.parse(message);

  // Step 2: Further validation of answers (if needed)
  for (const [questionId, answer] of Object.entries(event.answers)) {
    const questionAnswerSchema = getAnswerSchema(questionId);
    const validatedAnswer = questionAnswerSchema.parse(answer);
    // ... process validated answer
  }
}
```

#### Pattern 4: Environment Variable Validation

```typescript
// File: packages/validation/src/schemas/env.schema.ts

export const EnvironmentSchema = z.object({
  // Required
  NODE_ENV: z.enum(["development", "staging", "production"]),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),

  // Optional with defaults
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  PORT: z.coerce.number().default(3000),
  TIMEOUT_MS: z.coerce.number().default(30000),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

// Usage in app initialization
export function loadEnvironment(): Environment {
  // Get raw values from process.env (unknown)
  const raw: unknown = process.env;

  // Validate
  const validated = EnvironmentSchema.parse(raw);

  // Now safe to use throughout app
  return validated;
}
```

#### Pattern 5: Form Data Validation

```typescript
// File: packages/validation/src/schemas/form.schema.ts

export const LoginFormSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password too short"),
  rememberMe: z.boolean().default(false),
});

export type LoginForm = z.infer<typeof LoginFormSchema>;

// Usage in API endpoint
export async function handleLogin(formData: unknown): Promise<LoginResponse> {
  // Validate input
  const form = LoginFormSchema.parse(formData);

  // Type is guaranteed; pass to domain logic
  const result = authenticate(form.email, form.password);

  return result;
}
```

### 3.2 Validation Error Handling

**File**: `packages/validation/src/formatters/error-formatter.ts`

```typescript
export interface ValidationErrorResponse {
  success: false;
  data: null;
  error: {
    code: "VALIDATION_ERROR";
    message: string;
    violations: ValidationViolation[];
  };
}

export interface ValidationViolation {
  path: string[]; // e.g., ['user', 'email']
  message: string; // "Invalid email"
  received: unknown; // Actual value received
  expected: string; // Expected type/format
}

// Usage in API endpoint
export async function handleUserCreate(input: unknown): Promise<CreateUserResponse> {
  try {
    const validated = CreateUserSchema.parse(input);
    // ... create user with validated input
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          violations: error.errors.map((e) => ({
            path: e.path.map(String),
            message: e.message,
            received: input,
            expected: getExpectedFormat(e.code),
          })),
        },
      };
    }
    throw error; // Re-throw unexpected errors
  }
}
```

---

## Section 4: Guard Script Pattern Detection Specification

### 4.1 Patterns Detected

#### Pattern A: Implicit Any (`:any` type annotation)

**Regex**: `/:\s*any\b/`

**Examples Detected**:

```typescript
const x: any = {}; // ✅ Detected
let data: any; // ✅ Detected
function f(param: any) {} // ✅ Detected
type T = Record<string, any>; // ✅ Detected (inside type)
```

**Examples NOT Detected**:

```typescript
const name = "any"; // Not a type annotation
const anyValue = getAny(); // Not a type annotation
// This code uses 'any' in comments // Not code
```

#### Pattern B: Explicit Any Assertion (`as any`)

**Regex**: `/\bas\s+any\b/`

**Examples Detected**:

```typescript
const x = value as any; // ✅ Detected
const y = response as any; // ✅ Detected
return obj as any; // ✅ Detected
```

**Examples NOT Detected**:

```typescript
const any = 'string';                 // Not an assertion
const value: any = ...;               // Caught by Pattern A
```

#### Pattern C: Angle-Bracket Assertion (`<any>`)

**Regex**: `/<\s*any\s*>/`

**Examples Detected**:

```typescript
const x = <any>value; // ✅ Detected
const y = <any>response; // ✅ Detected
return <any>obj; // ✅ Detected
```

**Examples NOT Detected**:

```typescript
const generic = <T>(x: T) => x;       // Not <any>, generic
const tag = <div></div>;              // Not TypeScript, JSX
```

#### Pattern D: @ts-ignore Comment

**Regex**: `/@ts-ignore(?!\s+lint)/` (negative lookahead for `@ts-ignore lint`)

**Examples Detected**:

```typescript
// @ts-ignore
const x: any = {}; // ✅ Detected (@ts-ignore)

// @ts-ignore some reason
const y = unknown as User; // ✅ Detected

// ts-ignore (without @)
const z = value as any; // Not detected (need @)
```

**Examples NOT Detected**:

```typescript
// biome-ignore lint/suspicious/noExplicitAny -- reason
const x: any = {}; // Not detected (proper format)

// @ts-ignore lint/suspicious/noExplicitAny
const y = value as any; // Not detected (biome-ignore format)
```

### 4.2 Severity Classification

**Rules**:

1. If in protected package (`domain-core`, `types`, `validation`):
   - Severity = **ERROR** (must fix)
   - Exception = only allowed if in ALLOWED_ANY_EXCEPTIONS.json

2. If in other packages:
   - Severity = **WARNING** (should fix)
   - Exception = allowed per package discretion

3. If allow-listed and not expired:
   - Severity = **IGNORED** (not reported)

4. If allow-listed and expired:
   - Severity = **ERROR** (treat as violation; sunset passed)

---

## Section 5: TypeScript Strict Mode Configuration Schema

### 5.1 tsconfig.json Strict Flags

```json
{
  "compilerOptions": {
    // === STRICT MODE (enables 10 checks) ===
    "strict": true,

    // Equivalent to enabling individually:
    "alwaysStrict": true, // Emit "use strict" in all files
    "strictNullChecks": true, // null/undefined assignable only to explicit optional
    "strictFunctionTypes": true, // Strict function parameter and return types
    "strictBindCallApply": true, // Strict type checking for bind/call/apply
    "strictPropertyInitialization": true, // Class properties must be initialized
    "noImplicitThis": true, // Disallow 'this' with implicit 'any' type
    "noImplicitAny": true, // Disallow variables with implicit 'any' type
    "alwaysStrict": true, // Enforce strict mode semantics

    // === ADDITIONAL TYPE SAFETY FLAGS ===
    "noUncheckedIndexedAccess": true, // Accessing via index returns undefined
    "exactOptionalPropertyTypes": true, // Optional properties differentiated from undefined
    "noPropertyAccessFromIndexSignature": true, // Accessing via index requires key in string literal
    "noImplicitReturns": true, // Function must have explicit returns
    "noFallthroughCasesInSwitch": true, // Switch cases must have break/return
    "noImplicitOverride": true, // Must use override keyword for base class methods

    // === OTHER RECOMMENDED FLAGS ===
    "useDefineForClassFields": true, // Use Object.defineProperty for class fields
    "declaration": true, // Generate .d.ts files
    "declarationMap": true, // Generate source maps for .d.ts
    "sourceMap": true, // Generate source maps for .js
    "stripInternal": true, // Strip JSDoc @internal from code
    "resolveJsonModule": true, // Allow importing JSON modules
    "isolatedModules": true, // Ensure each file can be transpiled independently

    // === PERFORMANCE & OUTPUT ===
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "outDir": "./dist",
    "rootDir": "./src",
    "skipLibCheck": true, // Skip type checking of node_modules
    "skipDefaultLibCheck": true
  }
}
```

### 5.2 Strict Mode Runtime Guarantees

When all strict flags are enabled:

| Flag                         | Guarantee                                       | Impact                          |
| ---------------------------- | ----------------------------------------------- | ------------------------------- |
| `strict: true`               | Type annotations required; nullability explicit | No implicit `any` or `null`     |
| `noUncheckedIndexedAccess`   | Index access returns `T \| undefined`           | Safe array/object access        |
| `exactOptionalPropertyTypes` | `undefined` ≠ missing property                  | Clear missing property handling |
| `noImplicitReturns`          | All code paths must return                      | No undefined returns            |
| `noImplicitOverride`         | Override keyword required                       | Safe inheritance                |

---

## Section 6: CI Workflow Configuration

### 6.1 GitHub Actions Job Schema

**File**: `.github/workflows/ci-type-safety.yml`

```yaml
name: Type Safety Checks
description: "Comprehensive TypeScript type safety validation"

on:
  pull_request:
    branches: [main, staging]
    paths:
      - "**/*.ts"
      - "**/*.tsx"
      - "tsconfig*.json"
      - "biome.json"
      - "package.json"
      - "bun.lock"

jobs:
  type-safety:
    name: TypeScript Type Safety
    runs-on: ubuntu-latest
    timeout-minutes: 5

    outputs:
      violations_found: ${{ steps.guard.outputs.violations_found }}
      error_count: ${{ steps.guard.outputs.error_count }}

    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - uses: actions/cache@v3
        with:
          path: node_modules
          key: bun-${{ hashFiles('bun.lock') }}

      - run: bun install

      - id: typecheck
        name: TypeScript Type Check
        run: bun typecheck
        timeout-minutes: 2

      - id: guard
        name: Type Safety Guard Script
        run: |
          bun type-safety-guard --json > guard-output.json
          echo "violations_found=$(jq '.summary.totalViolations' guard-output.json)" >> $GITHUB_OUTPUT
          exit $(jq '.summary.errorCount' guard-output.json)
        timeout-minutes: 1
        continue-on-error: true

      - id: biome
        name: Biome Linting
        run: biome lint --only=suspicious
        timeout-minutes: 1

      - name: Report Results
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const guard = JSON.parse(fs.readFileSync('guard-output.json', 'utf8'));

            let body = `## Type Safety Check Results\n\n`;
            body += `- Violations: ${guard.summary.totalViolations}\n`;
            body += `- Errors: ${guard.summary.errorCount}\n`;
            body += `- Warnings: ${guard.summary.warningCount}\n`;

            if (guard.summary.errorCount > 0) {
              body += `\n### ❌ Must Fix (${guard.summary.errorCount} errors)\n\n`;
              guard.results
                .filter(r => r.severity === 'error')
                .slice(0, 5)
                .forEach(v => {
                  body += `- **${v.file}:${v.line}** - ${v.message}\n`;
                });
            }

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });
```

---

## Section 7: Biome Configuration

### 7.1 biome.json Schema

```json
{
  "linter": {
    "enabled": true,
    "rules": {
      // Type safety rules
      "suspicious": {
        "noExplicitAny": {
          "level": "error",
          "description": "Disallow explicit 'any' type without justification"
        }
      },

      // Additional recommended rules
      "correctness": {
        "noUnnecessaryElse": {
          "level": "warn"
        }
      },

      "style": {
        "noVar": {
          "level": "error"
        }
      }
    },

    "ignore": [
      "node_modules/**",
      "**/dist/**",
      "**/build/**",
      "coverage/**",
      "**/*.test.ts",
      "**/*.spec.ts"
    ]
  }
}
```

---

**Document End**

**Certification**: All data models, schemas, and formats documented and validated.
