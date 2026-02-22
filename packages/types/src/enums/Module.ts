/**
 * Module Enum - Product Module Definitions
 *
 * Zidney platform modules that can be enabled per product.
 * Used in product configuration and license provisioning.
 *
 * Stage: STAGE_09_PRODUCTS
 * Trust Chain: Product → License → Workspace
 */

/**
 * Available modules in the Zidney platform
 * - MCQ: Multiple Choice Questions assessment engine
 * - TRADITIONAL_EXAMS: Long-form written exams
 * - EXERCISES: Interactive practice exercises and drills
 * - LIBRARY: Content library and resource management
 * - LIVES: Live session management and classrooms
 * - FORUM: Discussion forums and Q&A
 */
export enum Module {
  MCQ = 'MCQ',
  TRADITIONAL_EXAMS = 'TRADITIONAL_EXAMS',
  EXERCISES = 'EXERCISES',
  LIBRARY = 'LIBRARY',
  LIVES = 'LIVES',
  FORUM = 'FORUM',
}

/**
 * Type-safe array of all module values
 */
export const ALL_MODULES: Module[] = Object.values(Module)

/**
 * Module labels for UI display
 */
export const MODULE_LABELS: Record<Module, Record<'en' | 'ar', string>> = {
  [Module.MCQ]: {
    en: 'Multiple Choice Questions',
    ar: 'الأسئلة متعددة الخيارات',
  },
  [Module.TRADITIONAL_EXAMS]: {
    en: 'Traditional Exams',
    ar: 'الامتحانات التقليدية',
  },
  [Module.EXERCISES]: {
    en: 'Exercises',
    ar: 'التمارين',
  },
  [Module.LIBRARY]: {
    en: 'Content Library',
    ar: 'مكتبة المحتوى',
  },
  [Module.LIVES]: {
    en: 'Live Sessions',
    ar: 'الجلسات المباشرة',
  },
  [Module.FORUM]: {
    en: 'Discussion Forum',
    ar: 'منتدى النقاش',
  },
}

/**
 * Validate if a value is a valid module
 */
export function isValidModule(value: unknown): value is Module {
  return (
    typeof value === 'string' && Object.values(Module).includes(value as Module)
  )
}

/**
 * Get module label by key and language
 */
export function getModuleLabel(
  module: Module,
  lang: 'en' | 'ar' = 'en'
): string {
  return MODULE_LABELS[module][lang]
}

/**
 * Get module label with fallback to English if Arabic not available
 */
export function getModuleLabelWithFallback(
  module: Module,
  lang: 'en' | 'ar' = 'en'
): string {
  if (lang === 'ar') {
    return MODULE_LABELS[module]['ar'] || MODULE_LABELS[module]['en']
  }
  return MODULE_LABELS[module]['en']
}

/**
 * Validate module array
 */
export function validateModuleArray(modules: unknown[]): modules is Module[] {
  if (!Array.isArray(modules)) return false
  if (modules.length === 0) return false
  return modules.every(isValidModule)
}
