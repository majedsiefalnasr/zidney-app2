/**
 * useMultiLanguageForm Composable
 * LOCKED DECISION 5: Per-language validation with minimum 1 required language enforcement
 * Default language always required; requiredLanguages.length >= 1 enforced
 */

import { computed, ref, watch } from 'vue'
import type { Language, ValidationError, ValidationRule } from '../types'

export interface UseMultiLanguageFormOptions {
  languages: Language[]
  requiredLanguages?: string[]
  validationRules?: Record<string, ValidationRule[]>
  initialValues?: Record<string, string>
}

export interface LanguageValidationState {
  errors: ValidationError[]
  isDirty: boolean
}

export function useMultiLanguageForm(options: UseMultiLanguageFormOptions) {
  // Ensure minimum 1 required language (LOCKED DECISION 5)
  const initializeRequiredLanguages = (): string[] => {
    const provided = options.requiredLanguages ?? []

    // If empty, default to first language (or default language if exists)
    if (provided.length === 0) {
      const defaultLang = options.languages.find((l) => l.isDefault)
      return defaultLang
        ? [defaultLang.code]
        : [options.languages[0]?.code].filter(Boolean)
    }

    return provided
  }

  // State
  const formValues = ref<Record<string, string>>(options.initialValues ?? {})
  const requiredLanguages = ref<string[]>(initializeRequiredLanguages())
  const languageErrors = ref<Record<string, ValidationError[]>>({})
  const globalErrors = ref<ValidationError[]>([])
  const isDirty = ref(false)

  // Initialize empty values for all languages
  if (Object.keys(formValues.value).length === 0) {
    options.languages.forEach((lang) => {
      formValues.value[lang.code] = ''
    })
  }

  // Computed: Filled languages (have non-empty content)
  const filledLanguages = computed(() => {
    const filled = new Set<string>()
    options.languages.forEach((lang) => {
      if ((formValues.value[lang.code] ?? '').trim()) {
        filled.add(lang.code)
      }
    })
    return filled
  })

  // Computed: Translation coverage percentage
  const translationCoverage = computed(() => {
    if (options.languages.length === 0) return 0
    return Math.round(
      (filledLanguages.value.size / options.languages.length) * 100
    )
  })

  // Method: Validate single language
  const validateLanguage = (
    code: string,
    value?: string
  ): ValidationError[] => {
    const errors: ValidationError[] = []
    const actualValue = value ?? formValues.value[code] ?? ''
    const rules = options.validationRules?.[code] ?? []

    for (const rule of rules) {
      const error = rule.validate(actualValue)
      if (error) {
        errors.push({
          field: code,
          message: error,
          code: rule.type,
        })
      }
    }

    languageErrors.value[code] = errors
    return errors
  }

  // Method: Validate all languages
  const validateAllLanguages = (): boolean => {
    let hasErrors = false

    options.languages.forEach((lang) => {
      const errors = validateLanguage(lang.code)
      if (errors.length > 0) {
        hasErrors = true
      }
    })

    return !hasErrors
  }

  // Method: Validate global constraints (LOCKED DECISION 5)
  const validateGlobal = (): ValidationError[] => {
    const errors: ValidationError[] = []

    // Check: Default language required
    const defaultLang = options.languages.find((l) => l.isDefault)
    if (defaultLang && !(formValues.value[defaultLang.code] ?? '').trim()) {
      errors.push({
        field: defaultLang.code,
        message: `Default language (${defaultLang.name}) is required`,
        code: 'required_language',
      })
    }

    // Check: Minimum 1 required language (LOCKED DECISION 5)
    if (requiredLanguages.value.length === 0) {
      console.warn(
        'No required languages specified. Defaulting to minimum 1 required language.'
      )
      requiredLanguages.value = [
        defaultLang?.code ?? options.languages[0]?.code,
      ].filter(Boolean)
    }

    // Check: All required languages have content (LOCKED DECISION 5)
    for (const langCode of requiredLanguages.value) {
      if (!(formValues.value[langCode] ?? '').trim()) {
        const lang = options.languages.find((l) => l.code === langCode)
        errors.push({
          field: langCode,
          message: `Required language (${lang?.name}) must have content`,
          code: 'required_language_empty',
        })
      }
    }

    globalErrors.value = errors
    return errors
  }

  // Computed: Is form valid? (all languages pass validation + global constraints)
  const isValid = computed(() => {
    const languageErrorsExist = Object.values(languageErrors.value).some(
      (errs) => errs.length > 0
    )
    const globalErrorsExist = globalErrors.value.length > 0

    return !languageErrorsExist && !globalErrorsExist
  })

  // Method: Mark form as dirty
  const markDirty = (): void => {
    isDirty.value = true
  }

  // Method: Mark form as pristine
  const markPristine = (): void => {
    isDirty.value = false
  }

  // Method: Reset form
  const reset = (): void => {
    options.languages.forEach((lang) => {
      formValues.value[lang.code] = ''
    })
    languageErrors.value = {}
    globalErrors.value = []
    isDirty.value = false
  }

  // Method: Set initial values
  const setValues = (values: Record<string, string>): void => {
    Object.assign(formValues.value, values)
    markDirty()
  }

  // Method: Get form data
  const getFormData = (): Record<string, string> => {
    return { ...formValues.value }
  }

  // Method: Validate on submit
  const validateOnSubmit = (): boolean => {
    const langValid = validateAllLanguages()
    validateGlobal()

    return isValid.value
  }

  // Watch for value changes and validate
  watch(
    () => formValues.value,
    () => {
      if (isDirty.value) {
        // Re-validate all languages on change
        validateAllLanguages()
        validateGlobal()
      }
    },
    { deep: true }
  )

  return {
    // State (reactive)
    formValues: computed(() => formValues.value),
    languageErrors: computed(() => languageErrors.value),
    globalErrors: computed(() => globalErrors.value),
    requiredLanguages: computed(() => requiredLanguages.value),

    // Computed
    filledLanguages,
    translationCoverage,
    isValid,
    isDirty: computed(() => isDirty.value),

    // Methods
    validateLanguage,
    validateAllLanguages,
    validateGlobal,
    validateOnSubmit,
    markDirty,
    markPristine,
    reset,
    setValues,
    getFormData,
  }
}
