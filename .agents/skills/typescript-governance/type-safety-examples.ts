/**
 * Type Safety Examples for AI Governance Skill
 *
 * This file demonstrates correct patterns for type safety.
 * Reference this file when implementing type-safe code.
 *
 * Anti-patterns are shown in comments only - this file passes all linters.
 */

import { z } from 'zod'

// =============================================================================
// RULE 1: Never Use `any`
// =============================================================================

// WRONG pattern (anti-pattern - do not copy):
// function processUserDataWrong1(data: any) {
//   return data.name.toUpperCase() // Runtime error if data.name is undefined
// }

// WRONG pattern (anti-pattern - do not copy):
// function processUserDataWrong2(data: unknown) {
//   const unsafe = data as any
//   return unsafe.name // Loses type safety
// }

// CORRECT pattern - Use unknown + validate
const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
})

export function processUserDataRight(data: unknown): string {
  const user = UserSchema.parse(data) // Throws if invalid
  return user.name.toUpperCase() // Type-safe: user.name is definitely a string
}

// =============================================================================
// RULE 2: Validate External Data at Boundaries
// =============================================================================

// WRONG pattern (anti-pattern - do not copy):
// async function handleWebhookWrong(body: any) {
//   // No validation! body could be anything
//   await updateAttempt(body.attemptId, body.answers)
// }

// CORRECT pattern - External data validated
const WebhookSchema = z.object({
  attemptId: z.string().uuid(),
  answers: z.array(z.object({ questionId: z.string(), answer: z.string() })),
})

export async function handleWebhookRight(body: unknown): Promise<void> {
  const payload = WebhookSchema.parse(body) // Throws if invalid
  // Type-safe: payload is validated
  void payload.attemptId && payload.answers
}

// =============================================================================
// RULE 3: Use Generics for Dynamic Types, Not `any`
// =============================================================================

// WRONG pattern (anti-pattern - do not copy):
// function cloneWrong(input: any): any {
//   return JSON.parse(JSON.stringify(input))
// }

// CORRECT pattern - Using generics
export function cloneRight<T>(input: T): T {
  return JSON.parse(JSON.stringify(input))
}

// Generic function with constraint
export function getFirstItem<T>(items: T[]): T | undefined {
  return items[0]
}

// Generic with multiple constraints
export function create<T extends { id: string; createdAt: Date }>(data: T): T {
  return {
    ...data,
    createdAt: new Date(),
  }
}

// =============================================================================
// RULE 4: Justify All @ts-expect-error Comments
// =============================================================================

// WRONG pattern (anti-pattern - do not copy):
// @ts-expect-error
// const value = someProperty

// WRONG pattern (anti-pattern - do not copy):
// @ts-expect-error this assignment is weird
// const value2 = anotherProperty

// CORRECT pattern - Specific justification with library, version, issue
// @ts-expect-error - zod: v3.21 - https://github.com/colinhacks/zod/issues/1821
// TypeScript 5.0 doesn't infer return type correctly with this zod syntax
export const parsed = z.string().parse('data')

// =============================================================================
// ADVANCED PATTERNS
// =============================================================================

// Union types for flexibility without any
export type Result<T> = { success: true; data: T } | { success: false; error: string }

export function handleResult<T>(result: Result<T>): void {
  if (result.success) {
    void result.data // T ✅
  } else {
    void result.error // string ✅
  }
}

// Nested validation
const CommentSchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  author: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
})

export type Comment = z.infer<typeof CommentSchema>

export async function createComment(data: unknown): Promise<Comment> {
  return CommentSchema.parse(data)
}

// =============================================================================
// SUMMARY
// =============================================================================

/**
 * Key Takeaways:
 *
 * 1. NEVER use `any` - use `unknown` instead
 *    - unknown requires validation before use
 *    - Validation preserves type safety
 *
 * 2. VALIDATE all external data immediately
 *    - API request bodies, URL params
 *    - Database query results
 *    - Queue messages
 *    - Environment variables
 *
 * 3. USE GENERICS for flexible types
 *    - function<T>(input: T): T
 *    - Preserves type information
 *    - No runtime overhead
 *
 * 4. JUSTIFY @ts-expect-error with specific details
 *    - Library name and version
 *    - Issue link or reason
 *    - Only when blocked by external issues
 *
 * Pattern: unknown → validate → use safely ✅
 */
