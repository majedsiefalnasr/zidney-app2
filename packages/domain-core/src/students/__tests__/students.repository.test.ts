import { describe, expect, it, vi } from 'vitest'
import { StudentError } from '../students.errors'
import {
  listStudents,
  softDeleteStudent,
  updateStudentStatus,
  validateDivisionActive,
} from '../students.repository'

describe('students.repository', () => {
  it('validateDivisionActive throws when division not found', async () => {
    const client = { query: vi.fn().mockResolvedValueOnce({ rows: [] }) }
    await expect(validateDivisionActive(client as any, 'w', 'div1')).rejects.toBeInstanceOf(
      StudentError
    )
  })

  it('validateDivisionActive throws when division inactive', async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({ rows: [{ id: 'div1', status: 'DISABLED' }] }),
    }
    await expect(validateDivisionActive(client as any, 'w', 'div1')).rejects.toBeInstanceOf(
      StudentError
    )
  })

  it('validateDivisionActive succeeds when division enabled', async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({ rows: [{ id: 'div1', status: 'ENABLED' }] }),
    }
    await expect(validateDivisionActive(client as any, 'w', 'div1')).resolves.toBeUndefined()
  })

  it('updateStudentStatus includes token_version bump when requested', async () => {
    const returnedRow = {
      id: 's1',
      external_id: null,
      email: 'a@b.com',
      first_name: 'A',
      last_name: 'B',
      division_id: null,
      department_id: null,
      group_id: null,
      semester_id: null,
      phone: null,
      subscription_status: 'NONE',
      status: 'DISABLED',
      token_version: 1,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    }
    const client = { query: vi.fn().mockResolvedValue({ rows: [returnedRow] }) }
    const res = await updateStudentStatus(client as any, 'w', 's1', 'DISABLED', true)
    expect(client.query).toHaveBeenCalled()
    const sql = (client.query as any).mock.calls[0][0] as string
    expect(sql).toContain('token_version = token_version + 1')
    expect(res).toEqual(returnedRow)
  })

  it('softDeleteStudent returns true when rowCount>0 and false when 0', async () => {
    const client1 = { query: vi.fn().mockResolvedValue({ rowCount: 1 }) }
    expect(await softDeleteStudent(client1 as any, 'w', 's1')).toBe(true)
    const client2 = { query: vi.fn().mockResolvedValue({ rowCount: 0 }) }
    expect(await softDeleteStudent(client2 as any, 'w', 's1')).toBe(false)
  })

  it('listStudents returns rows and total with search filter', async () => {
    const studentRow = {
      id: 's1',
      external_id: null,
      email: 'a@b.com',
      first_name: 'A',
      last_name: 'B',
      division_id: null,
      department_id: null,
      group_id: null,
      semester_id: null,
      phone: null,
      subscription_status: 'NONE',
      status: 'ACTIVE',
      token_version: 0,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    }
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // countResult
        .mockResolvedValueOnce({ rows: [studentRow] }), // data
    }
    const res = await listStudents(client as any, { page: 1, limit: 10, search: 'alice' })
    expect(res.total).toBe(1)
    expect(res.rows[0].email).toBe('a@b.com')
  })
})
