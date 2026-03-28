/**
 * Schema Validator Utility
 *
 * Purpose: Centralized JSON schema validation for architecture artifacts
 * Used by: ai-guard, infra-audit, architecture-diff, validate-architecture-brain
 *
 * Provides:
 * - JSON structure validation
 * - Artifact-specific schema enforcement
 * - Error reporting with context
 
 * @library-module
*/

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: string[]
}

export interface ValidationError {
  path: string
  message: string
  expected?: string
  actual?: string
}

export interface SchemaDefinition {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean'
  required?: string[]
  properties?: Record<string, SchemaDefinition>
  items?: SchemaDefinition
  minItems?: number
  maxItems?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  enum?: unknown[]
  minimum?: number
  maximum?: number
  additionalProperties?: boolean | SchemaDefinition
}

/**
 * Validate JSON object against a schema definition
 */
export function validateSchema(
  data: unknown,
  schema: SchemaDefinition,
  path = 'root'
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: string[] = []

  // Type validation
  if (!isValidType(data, schema.type)) {
    errors.push({
      path,
      message: `Type mismatch at ${path}`,
      expected: schema.type,
      actual: typeof data,
    })
    return { valid: false, errors, warnings }
  }

  if (
    schema.type === 'object' &&
    typeof data === 'object' &&
    data !== null &&
    !Array.isArray(data)
  ) {
    const obj = data as Record<string, unknown>

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in obj)) {
          errors.push({
            path: `${path}.${field}`,
            message: `Required field missing: ${field}`,
          })
        }
      }
    }

    // Check properties
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          const result = validateSchema(obj[key], propSchema, `${path}.${key}`)
          errors.push(...result.errors)
          warnings.push(...result.warnings)
        }
      }
    }

    // Additional properties check
    if (schema.additionalProperties === false && schema.properties) {
      const allowedKeys = new Set(Object.keys(schema.properties))
      if (schema.required) {
        for (const k of schema.required) {
          allowedKeys.add(k)
        }
      }
      for (const key of Object.keys(obj)) {
        if (!allowedKeys.has(key)) {
          warnings.push(`${path}: unexpected property "${key}"`)
        }
      }
    }
  }

  if (schema.type === 'array' && Array.isArray(data)) {
    const arr = data as unknown[]

    if (schema.minItems !== undefined && arr.length < schema.minItems) {
      errors.push({
        path,
        message: `Array too short (${arr.length} < ${schema.minItems})`,
      })
    }

    if (schema.maxItems !== undefined && arr.length > schema.maxItems) {
      errors.push({
        path,
        message: `Array too long (${arr.length} > ${schema.maxItems})`,
      })
    }

    if (schema.items) {
      for (let i = 0; i < arr.length; i++) {
        const result = validateSchema(arr[i], schema.items, `${path}[${i}]`)
        errors.push(...result.errors)
        warnings.push(...result.warnings)
      }
    }
  }

  if (schema.type === 'string' && typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push({
        path,
        message: `String too short (${data.length} < ${schema.minLength})`,
      })
    }

    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push({
        path,
        message: `String too long (${data.length} > ${schema.maxLength})`,
      })
    }

    if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
      errors.push({
        path,
        message: `String does not match pattern: ${schema.pattern}`,
      })
    }

    if (schema.enum && !schema.enum.includes(data)) {
      errors.push({
        path,
        message: `String not in enum: ${schema.enum.join(', ')}`,
      })
    }
  }

  if (schema.type === 'number' && typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push({
        path,
        message: `Number too small (${data} < ${schema.minimum})`,
      })
    }

    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push({
        path,
        message: `Number too large (${data} > ${schema.maximum})`,
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Check if a value matches the expected type
 */
function isValidType(data: unknown, expectedType: string): boolean {
  if (expectedType === 'object') {
    return typeof data === 'object' && data !== null
  }
  if (expectedType === 'array') {
    return Array.isArray(data)
  }
  return typeof data === expectedType
}

/**
 * Validate architectural contract structure
 */
export function validateArchitectureContract(data: unknown): ValidationResult {
  const schema: SchemaDefinition = {
    type: 'object',
    properties: {
      version: { type: 'string' },
      layerRules: {
        type: 'object',
        properties: {
          forbidden: { type: 'object', additionalProperties: true },
        },
        additionalProperties: true,
      },
      dependencyRules: {
        type: 'object',
        properties: {
          forbidden: { type: 'object', additionalProperties: true },
        },
        additionalProperties: true,
      },
      modules: {
        type: 'object',
        additionalProperties: true,
      },
    },
    additionalProperties: true,
  }

  return validateSchema(data, schema)
}

/**
 * Validate architecture map structure
 */
export function validateArchitectureMap(data: unknown): ValidationResult {
  const schema: SchemaDefinition = {
    type: 'object',
    properties: {
      version: { type: 'string' },
      modules: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: {
            layer: { type: 'string' },
            allowed_dependencies: { type: 'array', items: { type: 'string' } },
            forbidden_dependencies: { type: 'array', items: { type: 'string' } },
          },
          additionalProperties: true,
        },
      },
    },
    additionalProperties: true,
  }

  return validateSchema(data, schema)
}

/**
 * Validate dependency graph structure
 */
export function validateDependencyGraph(data: unknown): ValidationResult {
  const schema: SchemaDefinition = {
    type: 'object',
    required: ['edges', 'modules'],
    properties: {
      edges: {
        type: 'array',
        items: {
          type: 'object',
          required: ['from', 'to'],
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
            weight: { type: 'number' },
          },
        },
      },
      modules: {
        type: 'array',
        items: { type: 'string' },
      },
      timestamp: { type: 'number' },
      schema_version: { type: 'string' },
    },
    additionalProperties: true,
  }

  return validateSchema(data, schema)
}

/**
 * Validate architecture brain structure
 */
export function validateArchitectureBrain(data: unknown): ValidationResult {
  const schema: SchemaDefinition = {
    type: 'object',
    properties: {
      timestamp: { type: 'number' },
      modules: {
        type: 'array',
        items: { type: 'string' },
      },
      edges: {
        type: 'array',
        items: {
          type: 'object',
          required: ['from', 'to'],
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
          },
        },
      },
      rules: {
        type: 'object',
        additionalProperties: true,
      },
      violations: {
        type: 'array',
        items: { type: 'object' },
      },
      score: { type: 'number' },
    },
    additionalProperties: true,
  }

  return validateSchema(data, schema)
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(result: ValidationResult): string {
  if (result.valid) {
    return 'Schema validation: PASS'
  }

  const lines: string[] = ['Schema validation: FAIL', '']

  if (result.errors.length > 0) {
    lines.push('Errors:')
    result.errors.forEach((err) => {
      lines.push(`  ${err.path}: ${err.message}`)
      if (err.expected) {
        lines.push(`    Expected: ${err.expected}, Got: ${err.actual}`)
      }
    })
  }

  if (result.warnings.length > 0) {
    lines.push('Warnings:')
    result.warnings.forEach((warn) => {
      lines.push(`  ${warn}`)
    })
  }

  return lines.join('\n')
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: string[]
}

export interface ValidationError {
  path: string
  message: string
  expected?: string
  actual?: string
}

export interface SchemaDefinition {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean'
  required?: string[]
  properties?: Record<string, SchemaDefinition>
  items?: SchemaDefinition
  minItems?: number
  maxItems?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  enum?: unknown[]
  minimum?: number
  maximum?: number
  additionalProperties?: boolean | SchemaDefinition
}

/**
 * Validate JSON object against a schema definition
 */
