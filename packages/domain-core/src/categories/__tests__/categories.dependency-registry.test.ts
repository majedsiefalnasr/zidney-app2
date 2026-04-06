import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  categoryDependencyRegistry,
  checkCategoryDependencies,
} from '../categories.dependency-registry'

describe('categoryDependencyRegistry', () => {
  beforeEach(() => {
    // clear global registry before each test
    categoryDependencyRegistry.length = 0
  })

  it('returns 0 when registry is empty', async () => {
    const res = await checkCategoryDependencies({} as any, 'cat-1')
    expect(res).toBe(0)
  })

  it('sums results from registered dependency check functions', async () => {
    const fn1 = vi.fn(async (_db: any, _catId: string) => 2)
    const fn2 = vi.fn(async (_db: any, _catId: string) => 3)

    categoryDependencyRegistry.push(fn1, fn2)

    const res = await checkCategoryDependencies({} as any, 'cat-1')

    expect(res).toBe(5)
    expect(fn1).toHaveBeenCalledWith(expect.anything(), 'cat-1')
    expect(fn2).toHaveBeenCalledWith(expect.anything(), 'cat-1')
  })
})
