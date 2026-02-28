/**
 * Password Validator
 *
 * File: packages/validation/src/password.validator.ts
 * Task: T014
 * Phase: 3 - Member Management CRUD
 *
 * Password complexity validation for MMC members.
 *
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one digit (0-9)
 * - At least one special character (!@#$%^&*)
 *
 * Properties:
 * - Reusable across login, member creation, invitation acceptance
 * - Clear error messages for UX
 * - No length maximums (allow passphrases)
 */

export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
  strength?: 'weak' | 'moderate' | 'strong'
}

/**
 * Validate password complexity
 *
 * @param password - Password to validate
 * @returns Validation result with errors if invalid
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = []
  let strengthScore = 0

  // Check minimum length
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  } else {
    strengthScore += 1
  }

  // Check uppercase letters
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z)')
  } else {
    strengthScore += 1
  }

  // Check lowercase letters
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z)')
  } else {
    strengthScore += 1
  }

  // Check digits
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit (0-9)')
  } else {
    strengthScore += 1
  }

  // Check special characters
  if (!/[!@#$%^&*()_+\-=[\]{};:'",./<>?\\|`~]/.test(password)) {
    errors.push(
      'Password must contain at least one special character (!@#$%^&*()_+-=[]{};\':",./<>?/\\|`~)'
    )
  } else {
    strengthScore += 1
  }

  // Determine strength
  let strength: 'weak' | 'moderate' | 'strong' = 'weak'
  if (strengthScore >= 4) strength = 'moderate'
  if (strengthScore >= 5) strength = 'strong'
  if (password.length >= 12) strength = 'strong' // Bonus for longer passwords

  return {
    valid: errors.length === 0,
    errors,
    strength,
  }
}

/**
 * Check if password is valid
 *
 * Shorthand for validatePassword().valid
 */
export function isPasswordValid(password: string): boolean {
  return validatePassword(password).valid
}

/**
 * Get human-readable error message
 *
 * Joins all validation errors into a single message
 */
export function getPasswordErrorMessage(password: string): string {
  const result = validatePassword(password)
  if (result.valid) {
    return ''
  }
  return result.errors.join('; ')
}
