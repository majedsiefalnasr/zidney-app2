import { z } from 'zod'

/**
 * External Data Validation Schemas
 *
 * These schemas convert unknown external data into strictly typed models.
 * Used at API entry points to validate requests, database results, queue messages, etc.
 */

// Generic wrapper for external data
export const UnknownDataSchema = z.unknown()

// API Request/Response validation
export const ApiRequestSchema = z.object({
  headers: z.record(z.string()).optional(),
  body: UnknownDataSchema,
  query: z.record(z.string()).optional(),
  params: z.record(z.string()).optional(),
})

// Database result validation
export const DatabaseResultSchema = z.object({
  id: z.string().uuid().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  data: UnknownDataSchema,
})

// Queue message validation
export const QueueMessageSchema = z.object({
  id: z.string(),
  type: z.string(),
  payload: UnknownDataSchema,
  timestamp: z.date(),
  retryCount: z.number().int().nonnegative().optional(),
})

// Environment variable validation
export const EnvVarSchema = z.string()

// Generic validation result
export const ValidationResultSchema = z.union([
  z.object({ success: z.literal(true), data: UnknownDataSchema }),
  z.object({ success: z.literal(false), error: z.string() }),
])

/**
 * Usage example:
 *
 * const externalData = await fetch('/api/users').then(r => r.json());
 * const validated = ApiRequestSchema.parse(externalData);
 * // Now validated is strictly typed, safe to use
 */
