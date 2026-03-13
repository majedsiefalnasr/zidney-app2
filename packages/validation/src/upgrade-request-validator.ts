/**
 * Input validation schema (Task 19)
 * Validates upgrade and rollback request bodies
 */

/**
 * Validate upgrade request body
 */
export function validateUpgradeRequest(body: unknown): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  if (!body || typeof body !== 'object' || body === null) {
    errors.push('Request body is required')
    return { isValid: false, errors }
  }

  const payload = body as Record<string, unknown>

  // target_schema_version is required
  if (!payload.target_schema_version || typeof payload.target_schema_version !== 'string') {
    errors.push('target_schema_version is required')
  } else {
    // Validate SemVer format: X.Y.Z
    if (!/^\d+\.\d+\.\d+$/.test(payload.target_schema_version)) {
      errors.push(`Invalid version format: "${payload.target_schema_version}". Expected: X.Y.Z`)
    }
  }

  // dry_run is optional boolean
  if (payload.dry_run !== undefined && typeof payload.dry_run !== 'boolean') {
    errors.push('dry_run must be boolean')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validate rollback request body
 */
export function validateRollbackRequest(body: unknown): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  if (!body || typeof body !== 'object' || body === null) {
    errors.push('Request body is required')
    return { isValid: false, errors }
  }

  const payload = body as Record<string, unknown>

  // snapshot_id is required
  if (!payload.snapshot_id || typeof payload.snapshot_id !== 'string') {
    errors.push('snapshot_id is required')
  } else if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.snapshot_id)
  ) {
    errors.push('snapshot_id must be valid UUID')
  }

  // confirmation_code is required and exact match
  if (!payload.confirmation_code || typeof payload.confirmation_code !== 'string') {
    errors.push('confirmation_code is required')
  } else if (payload.confirmation_code !== 'CONFIRM_ROLLBACK_TO_PREVIOUS') {
    errors.push('Invalid confirmation code')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
