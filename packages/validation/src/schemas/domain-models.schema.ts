import { z } from 'zod'

/**
 * Domain Model Validation Schemas
 *
 * These schemas validate domain models after external data has been processed.
 * Ensures domain logic always receives properly typed data.
 */

// User domain model
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['student', 'instructor', 'admin']),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type User = z.infer<typeof UserSchema>

// Workspace domain model
export const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  status: z.enum(['active', 'archived', 'suspended']),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type Workspace = z.infer<typeof WorkspaceSchema>

// Attempt domain model
export const AttemptSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  examId: z.string().uuid(),
  status: z.enum(['in-progress', 'submitted', 'graded', 'archived']),
  startedAt: z.date(),
  submittedAt: z.date().optional(),
  gradedAt: z.date().optional(),
  score: z.number().nonnegative().max(100).optional(),
})

export type Attempt = z.infer<typeof AttemptSchema>

/**
 * Generic domain model wrapper
 */
export const DomainModelSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

/**
 * Usage example:
 *
 * const userData = await fetchUserFromApi();
 * const user = UserSchema.parse(userData);
 * // Now user is strictly typed User, safe to pass to domain logic
 */
