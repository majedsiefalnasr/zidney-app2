/**
 * Validation Types for Forms and Filters
 * LOCKED DECISION 5: Per-language validation with minimum 1 required language
 */

import type { Language } from './common'

// Base validation rule
export interface ValidationRule {
  id?: string
  type: string
  validate: (value: any) => string | null // Returns error message or null
  message?: string
  parameters?: Record<string, any>
}

// Specific validation rules
export interface RequiredRule extends ValidationRule {
  type: 'required'
}

export interface MinLengthRule extends ValidationRule {
  type: 'minLength'
  parameters: { minLength: number }
}

export interface MaxLengthRule extends ValidationRule {
  type: 'maxLength'
  parameters: { maxLength: number }
}

export interface PatternRule extends ValidationRule {
  type: 'pattern'
  parameters: { pattern: RegExp | string }
}

export interface EmailRule extends ValidationRule {
  type: 'email'
}

export interface CustomRule extends ValidationRule {
  type: 'custom'
  parameters: { validate: (value: any) => string | null }
}

// Union type for common rules
export type CommonValidationRule =
  | RequiredRule
  | MinLengthRule
  | MaxLengthRule
  | PatternRule
  | EmailRule
  | CustomRule
  | ValidationRule

// Validation error
export interface ValidationError {
  field: string
  message: string
  code?: string
  value?: any
  rule?: ValidationRule
}

// Validation result
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings?: string[]
}

// Per-language validation (LOCKED DECISION 5)
export interface LanguageValidationConfig {
  language: Language
  rules: ValidationRule[]
  required?: boolean
  minLength?: number
  maxLength?: number
}

// Multi-language form validation (LOCKED DECISION 5)
export interface MultiLanguageValidationConfig {
  languages: Language[]
  requiredLanguages: string[] // Min 1 enforced (LOCKED DECISION 5)
  perLanguageRules?: Record<string, ValidationRule[]>
  globalRules?: ValidationRule[]
}

// Multi-language validation result (LOCKED DECISION 5)
export interface MultiLanguageValidationResult {
  isValid: boolean
  languageErrors: Record<string, ValidationError[]>
  globalErrors: ValidationError[]
  filledLanguages: Set<string>
  coverage: number // Percentage of languages with content (0-100)
}

// Async validation support
export interface AsyncValidationRule extends ValidationRule {
  validateAsync: (value: any) => Promise<string | null>
}

// Debounced validation
export interface DebouncedValidationConfig {
  debounceMs: number
  validateOnBlur?: boolean
  validateOnInput?: boolean
}

// Validator class for reusability
export interface Validator {
  validate: (value: any, rules: ValidationRule[]) => ValidationResult
  validateAsync: (
    value: any,
    rules: ValidationRule[]
  ) => Promise<ValidationResult>
}

// Validation context
export interface ValidationContext {
  fieldName: string
  fieldValue: any
  allValues?: Record<string, any>
  language?: string
}

// Type guards for rule types
export function isRequiredRule(rule: ValidationRule): rule is RequiredRule {
  return rule.type === 'required'
}

export function isAsyncValidationRule(
  rule: ValidationRule
): rule is AsyncValidationRule {
  return 'validateAsync' in rule
}
