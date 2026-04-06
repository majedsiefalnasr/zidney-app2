import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  countLessons,
  findActiveLessonsForSubject,
  findLessons,
  insertLesson,
  lessonNameExistsInSubject,
  subjectExists,
  updateLessonRow,
} from '../lessons.repository'

describe('lessons.repository', () => {
  let db: any

  beforeEach(() => {
    db = { query: vi.fn() }
  })

  it('countLessons returns 0 when no filters', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ total: '0' }] })
    const res = await countLessons(db, {})
    expect(res).toBe(0)
    const call = db.query.mock.calls[0]
    expect(String(call[0])).toContain('FROM lessons')
  })

  it('countLessons with filters builds WHERE and params', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ total: '5' }] })
    const res = await countLessons(db, { subject_id: 's1', status: 'ACTIVE', search: 'Foo' })
    expect(res).toBe(5)
    const call = db.query.mock.calls[0]
    const params = call[1]
    expect(params[0]).toBe('s1')
    expect(params[1]).toBe('ACTIVE')
    expect(params[2]).toContain('%foo%')
  })

  it('findLessons maps created_at/updated_at to Date', async () => {
    const row = {
      id: 'l1',
      subject_id: 's1',
      name: 'Lesson 1',
      code: 'L1',
      description: null,
      status: 'ENABLED',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
      created_by: null,
      updated_by: null,
    }
    db.query.mockResolvedValueOnce({ rows: [row] })
    const res = await findLessons(db, { offset: 0, limit: 10 })
    expect(res[0].created_at instanceof Date).toBe(true)
    expect(res[0].updated_at instanceof Date).toBe(true)
  })

  it('lessonNameExistsInSubject handles excludeId branch', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ exists: true }] })
    const r = await lessonNameExistsInSubject(db, 'sub-1', 'Name', 'exclude-1')
    expect(r).toBe(true)
    const call = db.query.mock.calls[0]
    expect(String(call[0])).toContain('AND id <> $3::uuid')
    expect(call[1]).toEqual(['sub-1', 'Name', 'exclude-1'])
  })

  it('insertLesson returns mapped row', async () => {
    const row = {
      id: 'l2',
      subject_id: 's2',
      name: 'New',
      code: null,
      description: null,
      status: 'ENABLED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'u1',
      updated_by: 'u1',
    }
    db.query.mockResolvedValueOnce({ rows: [row] })
    const res = await insertLesson(db, { subject_id: 's2', name: 'New' }, { user_id: 'u1' } as any)
    expect(res.id).toBe('l2')
  })

  it('updateLessonRow supports no-ops and multiple fields', async () => {
    const row = {
      id: 'l3',
      subject_id: 's3',
      name: 'X',
      code: null,
      description: null,
      status: 'DRAFT',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: null,
      updated_by: null,
    }

    db.query.mockResolvedValueOnce({ rows: [row] })
    const r1 = await updateLessonRow(db, 'l3', {}, 'u2')
    expect(r1.id).toBe('l3')

    db.query.mockResolvedValueOnce({ rows: [row] })
    const r2 = await updateLessonRow(db, 'l3', { name: 'Y', code: null, description: 'd' }, 'u2')
    expect(r2.name).toBe('X') // returned row is the mocked one
  })

  it('subjectExists and findActiveLessonsForSubject behave correctly', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ exists: true }] })
    expect(await subjectExists(db, 's1')).toBe(true)

    db.query.mockResolvedValueOnce({ rows: [{ id: 'a1', name: 'A', code: null }] })
    const list = await findActiveLessonsForSubject(db, 's1')
    expect(list[0]).toMatchObject({ id: 'a1', name: 'A' })
  })
})
