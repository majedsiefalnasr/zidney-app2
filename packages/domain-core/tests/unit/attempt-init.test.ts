import { describe, expect, it, vi } from 'vitest'
import { getOrCreateAttempt } from '../../src/attempts/attempt-init'

describe('getOrCreateAttempt', () => {
  it('returns existing attempt when pool query finds in-progress attempt', async () => {
    const fakeRow = { id: 'attempt-1', exam_id: 'exam-1', user_id: 'user-1', status: 'IN_PROGRESS' }
    const pool = {
      query: vi.fn(async () => ({ rows: [fakeRow] })),
    } as any

    const attempt = await getOrCreateAttempt(
      { examId: 'exam-1', userId: 'user-1', client: undefined },
      pool,
      'current-user'
    )
    expect(attempt).toBeDefined()
    expect((attempt as any).id).toBe('attempt-1')
    expect(pool.query).toHaveBeenCalled()
  })
})
