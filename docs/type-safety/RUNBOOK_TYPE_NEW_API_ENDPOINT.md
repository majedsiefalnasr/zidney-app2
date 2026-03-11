# Type Safety - Runbook: Type New API Endpoint

Step-by-step guide to creating a new API endpoint with full type safety.

## Checklist

- [ ] Define request/response schemas
- [ ] Create route handler with validation
- [ ] Add error handling
- [ ] Run typecheck (`bun typecheck`)
- [ ] Test with invalid data
- [ ] Add unit tests
- [ ] Document endpoint

## Step 1: Define Schemas

Create schemas for request and response data.

**File**: `packages/validation/src/schemas/myfeature.schema.ts`

```typescript
import { z } from "zod";

// Request validation
export const CreateAttemptSchema = z.object({
  examId: z.string().uuid(),
  studentId: z.string().uuid(),
  startedAt: z.coerce.date().default(() => new Date()),
});

export type CreateAttemptRequest = z.infer<typeof CreateAttemptSchema>;

// Response type
export interface AttemptResponse {
  id: string;
  examId: string;
  studentId: string;
  status: "in-progress" | "submitted" | "graded";
  startedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

## Step 2: Create Route Handler

**File**: `apps/api/src/routes/attempts.ts`

```typescript
import { Router } from "hono";
import { CreateAttemptSchema } from "@packages/validation/schemas/myfeature.schema";
import { createAttempt } from "@packages/domain-core/attempts";
import { logger } from "@packages/logger";

export const router = new Router();

// POST /attempts
router.post("/", async (c) => {
  const correlationId = c.req.header("x-correlation-id") || generateId();

  try {
    // Step 1: Validate request body
    const bodyData: unknown = await c.req.json();
    const request = CreateAttemptSchema.parse(bodyData);

    // Step 2: Validate auth context
    const authenticated = c.get("auth"); // From middleware
    if (!authenticated) {
      return c.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Step 3: Call domain logic
    const attempt = await createAttempt(request);

    // Step 4: Return typed response
    logger.info("Attempt created", {
      correlationId,
      attemptId: attempt.id,
      studentId: attempt.studentId,
    });

    return c.json(attempt, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid attempt creation request", {
        correlationId,
        errors: error.issues,
      });
      return c.json(
        {
          error: "Invalid request",
          details: error.issues,
        },
        { status: 422 },
      );
    }

    logger.error("Failed to create attempt", {
      correlationId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return c.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
});

// GET /attempts/:id
router.get("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    // Validate UUID path param
    const idSchema = z.string().uuid();
    const validatedId = idSchema.parse(id);

    // Fetch from domain
    const attempt = await getAttemptById(validatedId);

    if (!attempt) {
      return c.json({ error: "Not found" }, { status: 404 });
    }

    return c.json(attempt);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid attempt ID" }, { status: 400 });
    }
    throw error;
  }
});
```

## Step 3: Integration & Error Handling

### Add to Router

**File**: `apps/api/src/routes/index.ts`

```typescript
import { router as attemptsRouter } from "./attempts";

export function registerRoutes(app: Hono) {
  app.route("/api/attempts", attemptsRouter);
}
```

### Error Middleware

```typescript
app.use(async (c, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          error: "Validation failed",
          issues: error.issues,
        },
        { status: 422 },
      );
    }

    logger.error("Unhandled error", {
      error: error instanceof Error ? error.message : "Unknown",
    });

    return c.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
});
```

## Step 4: Type Checking

### Run locally

```bash
bun typecheck
```

Should pass with no errors. If errors:

```bash
# See detailed errors
bun typecheck --listFiles

# Fix errors following RUNBOOK_FIX_TYPE_ERRORS.md
```

### Run in CI

```bash
bun validate:types
# Runs: typecheck + guard + biome lint
```

All must pass.

## Step 5: Testing

### Unit Test

**File**: `tests/unit/routes/attempts.test.ts`

```typescript
import { describe, test, expect } from "vitest";
import { Hono } from "hono";
import { router } from "@apps/api/src/routes/attempts";

describe("POST /attempts", () => {
  test("creates attempt with valid request", async () => {
    const app = new Hono();
    app.route("/attempts", router);

    const response = await app.request(
      new Request("http://localhost/attempts", {
        method: "POST",
        body: JSON.stringify({
          examId: "550e8400-e29b-41d4-a716-446655440000",
          studentId: "550e8400-e29b-41d4-a716-446655440001",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBeDefined();
    expect(data.status).toBe("in-progress");
  });

  test("rejects invalid exam ID", async () => {
    const response = await app.request(
      new Request("http://localhost/attempts", {
        method: "POST",
        body: JSON.stringify({
          examId: "not-a-uuid", // Invalid!
          studentId: "550e8400-e29b-41d4-a716-446655440001",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(422);
    const data = await response.json();
    expect(data.error).toBe("Invalid request");
  });

  test("rejects missing required fields", async () => {
    const response = await app.request(
      new Request("http://localhost/attempts", {
        method: "POST",
        body: JSON.stringify({
          examId: "550e8400-e29b-41d4-a716-446655440000",
          // studentId missing!
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(422);
  });
});

describe("GET /attempts/:id", () => {
  test("fetches attempt by ID", async () => {
    const response = await app.request(
      new Request("http://localhost/attempts/550e8400-e29b-41d4-a716-446655440000"),
    );

    expect(response.status).toBe(200);
  });

  test("rejects invalid UUID", async () => {
    const response = await app.request(new Request("http://localhost/attempts/not-a-uuid"));

    expect(response.status).toBe(400);
  });
});
```

### Run tests

```bash
bun test tests/unit/routes/attempts.test.ts
```

## Step 6: Documentation

Add to API documentation:

**File**: `docs/api/endpoints/attempts.md`

````markdown
# Attempts API

## Create Attempt

**Endpoint**: `POST /api/attempts`

**Request Body**:

```json
{
  "examId": "550e8400-e29b-41d4-a716-446655440000",
  "studentId": "550e8400-e29b-41d4-a716-446655440001",
  "startedAt": "2026-03-11T10:00:00Z"
}
```
````

**Requirements**:

- examId: Valid UUID of existing exam
- studentId: Valid UUID of enrolled student
- startedAt: Optional, defaults to now

**Success Response** (201):

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "examId": "550e8400-e29b-41d4-a716-446655440000",
  "studentId": "550e8400-e29b-41d4-a716-446655440001",
  "status": "in-progress",
  "startedAt": "2026-03-11T10:00:00Z",
  "createdAt": "2026-03-11T10:00:00Z",
  "updatedAt": "2026-03-11T10:00:00Z"
}
```

**Error Response** (422):

```json
{
  "error": "Invalid request",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["examId"],
      "message": "Required"
    }
  ]
}
```

## Get Attempt

**Endpoint**: `GET /api/attempts/:id`

**Path Parameters**:

- id: Valid UUID

**Success Response** (200):
[Same as Create response]

**Error Responses**:

- 400: Invalid UUID format
- 404: Attempt not found

````

## Quick Checklist

Before committing:

- [ ] `bun typecheck` passes
- [ ] `bun validate:types` passes
- [ ] Unit tests all pass
- [ ] No `any` types used
- [ ] All external data validated
- [ ] Error handling implemented
- [ ] Documentation written
- [ ] Git commit with `feat:` prefix

Example commit:

```bash
git add .
git commit -m "feat: add POST /attempts endpoint with full type safety"
````

---

See also: [Type Safety Handbook](./TYPE_SAFETY_HANDBOOK.md)
