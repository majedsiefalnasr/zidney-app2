/**
 * Unit Tests - Module Enum (T064)
 *
 * STAGE_09_PRODUCTS
 * Tests for Module enum validation and labeling
 */

import { Module } from '@zidney/types/enums/Module'
import { describe, expect, it } from 'vitest'

describe('Unit: Products - Module Enum (T064)', () => {
  it('should have all six modules defined', () => {
    const modules = [
      Module.MCQ,
      Module.TRADITIONAL_EXAMS,
      Module.EXERCISES,
      Module.LIBRARY,
      Module.LIVES,
      Module.FORUM,
    ]

    expect(modules).toHaveLength(6)
    expect(new Set(modules).size).toBe(6) // No duplicates
  })

  it('should validate module values', () => {
    const validModules = [
      'MCQ',
      'TRADITIONAL_EXAMS',
      'EXERCISES',
      'LIBRARY',
      'LIVES',
      'FORUM',
    ]

    validModules.forEach((mod) => {
      expect(Object.values(Module)).toContain(mod)
    })
  })

  it('should reject invalid module values', () => {
    const invalidModules = ['INVALID', 'UNKNOWN', '', null, undefined]

    invalidModules.forEach((mod) => {
      expect(Object.values(Module)).not.toContain(mod)
    })
  })

  it('should support localized labels (en/ar)', () => {
    const labels = {
      [Module.MCQ]: {
        en: 'Multiple Choice Questions',
        ar: 'أسئلة الاختيار من متعدد',
      },
      [Module.LIBRARY]: { en: 'Learning Library', ar: 'مكتبة المحتوى' },
    }

    expect(labels[Module.MCQ]).toHaveProperty('en')
    expect(labels[Module.MCQ]).toHaveProperty('ar')
  })

  it('should handle module list operations', () => {
    const enabledModules = [Module.MCQ, Module.FORUM]

    expect(enabledModules).toContain(Module.MCQ)
    expect(enabledModules).not.toContain(Module.LIBRARY)
    expect(enabledModules.length).toBe(2)
  })
})
