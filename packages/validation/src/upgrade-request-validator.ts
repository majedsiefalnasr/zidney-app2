/**
 * Input validation schema (Task 19)
 * Validates upgrade and rollback request bodies
 */

/**
 * Validate upgrade request body
 */
export function validateUpgradeRequest(body: any): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!body) {
    errors.push('Request body is required')
    return { isValid: false, errors }
  }

  // target_schema_version is required
  if (!body.target_schema_version) {
    errors.push('target_schema_version is required')
  } else {
    // Validate SemVer format: X.Y.Z
    if (!/^\d+\.\d+\.\d+$/.test(body.target_schema_version)) {
      errors.push(
        `Invalid version format: "${body.target_schema_version}". Expected: X.Y.Z`
      )
    }
  }

  // dry_run is optional boolean
  if (body.dry_run && typeof body.dry_run !== 'boolean') {
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
export function validateRollbackRequest(body: any): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!body) {
    errors.push('Request body is required')
    return { isValid: false, errors }
  }

  // snapshot_id is required
  if (!body.snapshot_id) {
    errors.push('snapshot_id is required')
  } else if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      body.snapshot_id
    )
  ) {
    errors.push('snapshot_id must be valid UUID')
  }

  // confirmation_code is required and exact match
  if (!body.confirmation_code) {
    errors.push('confirmation_code is required')
  } else if (body.confirmation_code !== 'CONFIRM_ROLLBACK_TO_PREVIOUS') {
    errors.push('Invalid confirmation code')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
