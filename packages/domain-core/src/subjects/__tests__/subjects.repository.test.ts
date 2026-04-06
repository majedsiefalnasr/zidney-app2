import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  casTransitionSubject,
  divisionExists,
  findSubjectById,
  semesterBelongsToDivision,
  semesterExists,
  subjectCodeExists,
  subjectNameExists,
} from '../subjects.repository'

describe('subjects.repository', () => {
  let db: any

  beforeEach(() => {
    db = { query: vi.fn() }
  })

  it('findSubjectById returns null when not found', async () => {
    db.query.mockResolvedValue({ rows: [] })
    const res = await findSubjectById(db, 's-1')
    expect(res).toBeNull()
  })

  it('findSubjectById maps row when present', async () => {
    const row = {
      id: 's-1',
      name: 'Math',
      code: 'MATH',
      division_id: null,
      semester_id: null,
      is_multilanguage: false,
      default_language: 'en',
      description: null,
      status: 'ACTIVE',
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    db.query.mockResolvedValue({ rows: [row] })
    const res = await findSubjectById(db, 's-1')
    expect(res).toMatchObject({ id: 's-1', name: 'Math', code: 'MATH' })
  })

  it('subjectNameExists respects excludeId branch and returns boolean', async () => {
    db.query.mockResolvedValue({ rows: [{ exists: true }] })
    const res1 = await subjectNameExists(db, 'Math')
    expect(res1).toBe(true)

    db.query.mockResolvedValue({ rows: [{ exists: false }] })
    await subjectNameExists(db, 'Math', 'exclude-1')
    const call = db.query.mock.calls[db.query.mock.calls.length - 1]
    const calledSql = call[0]
    const calledParams = call[1]
    expect(String(calledSql)).toContain('AND id <> $2::uuid')
    expect(calledParams).toEqual(['Math', 'exclude-1'])
  })

  it('subjectCodeExists returns boolean and supports excludeId', async () => {
    db.query.mockResolvedValue({ rows: [{ exists: false }] })
    const res = await subjectCodeExists(db, 'C1', 'ex')
    expect(res).toBe(false)
    const call = db.query.mock.calls[db.query.mock.calls.length - 1]
    expect(String(call[0])).toContain('AND id <> $2::uuid')
  })

  it('casTransitionSubject returns rowCount correctly', async () => {
    db.query.mockResolvedValue({ rowCount: 2 })
    const r1 = await casTransitionSubject(db, 's', 'ACTIVE' as any, 'DRAFT' as any)
    expect(r1).toEqual({ rowCount: 2 })

    db.query.mockResolvedValue({})
    const r2 = await casTransitionSubject(db, 's', 'ACTIVE' as any, 'DRAFT' as any)
    expect(r2).toEqual({ rowCount: 0 })
  })

  it('divisionExists and semesterExists return booleans', async () => {
    db.query.mockResolvedValue({ rows: [{ exists: true }] })
    expect(await divisionExists(db, 'd1')).toBe(true)
    expect(await semesterExists(db, 's1')).toBe(true)

    db.query.mockResolvedValue({ rows: [{ exists: false }] })
    expect(await divisionExists(db, 'd2')).toBe(false)
    expect(await semesterExists(db, 's2')).toBe(false)
  })

  it('semesterBelongsToDivision always returns true (forward-compatibility stub)', async () => {
    const r = await semesterBelongsToDivision(db, 'sem-1', 'div-1')
    expect(r).toBe(true)
  })
})
