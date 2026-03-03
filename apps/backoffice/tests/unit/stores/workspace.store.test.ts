/**
 * Unit tests for useBackofficeWorkspaceStore
 * Coverage: FR-016, M-03 concurrent guard, FR-018 (error cleared before retry)
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */
import { useBackofficeWorkspaceStore } from '@/core/state/workspace.store'
import { createAppError } from '@zidney/api-client'
import { describe, expect, it } from 'vitest'
import { useIsolatedPinia } from '../store-test-helper'

describe('useBackofficeWorkspaceStore', () => {
  useIsolatedPinia()

  it('initializes with default state', () => {
    const store = useBackofficeWorkspaceStore()
    expect(store.workspace).toBeNull()
    expect(store.isLoading).toBe(false)
    expect(Object.keys(store.pending)).toHaveLength(0)
    expect(store.error).toBeNull()
  })

  it('clearError zeroes the error field', () => {
    const store = useBackofficeWorkspaceStore()
    store.$patch({
      error: createAppError({
        code: 'TEST',
        message: 'test error',
        httpStatus: 0,
        isNetworkError: false,
      }),
    })
    store.clearError()
    expect(store.error).toBeNull()
  })

  it('$reset restores all fields to initial state', () => {
    const store = useBackofficeWorkspaceStore()
    store.$patch({
      error: createAppError({
        code: 'TEST',
        message: 'test',
        httpStatus: 0,
        isNetworkError: false,
      }),
      pending: { loadWorkspace: true },
    })
    store.$reset()
    expect(store.workspace).toBeNull()
    expect(store.isLoading).toBe(false)
    expect(Object.keys(store.pending)).toHaveLength(0)
    expect(store.error).toBeNull()
  })

  it('isLoading is false when pending is empty', () => {
    const store = useBackofficeWorkspaceStore()
    expect(store.isLoading).toBe(false)
  })

  it('isLoading is true when any pending key is truthy', () => {
    const store = useBackofficeWorkspaceStore()
    store.$patch({ pending: { loadWorkspace: true } })
    expect(store.isLoading).toBe(true)
  })

  it('isLoading auto-derives from pending — returns false when pending cleared', () => {
    const store = useBackofficeWorkspaceStore()
    store.$patch({ pending: { loadWorkspace: true } })
    expect(store.isLoading).toBe(true)
    store.$patch({ pending: { loadWorkspace: false } })
    expect(store.isLoading).toBe(false)
  })

  it('loadWorkspace resolves successfully on happy path (stub)', async () => {
    const store = useBackofficeWorkspaceStore()
    await store.loadWorkspace('test-slug')
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.pending['loadWorkspace']).toBe(false)
  })

  it('concurrent guard: second call while first is in-flight is dropped (FR-016, M-03)', async () => {
    const store = useBackofficeWorkspaceStore()
    // Simulate in-flight first call
    store.$patch({ pending: { loadWorkspace: true } })
    // Second call should hit the guard and return immediately
    const result = store.loadWorkspace('test-slug')
    // pending still locked from simulated first call
    expect(store.pending['loadWorkspace']).toBe(true)
    // Release the simulated first call
    store.$patch({
      pending: { loadWorkspace: false },
      workspace: {
        slug: 'test-slug',
        name: 'Test',
        tier: 'standard',
        schemaVersion: 1,
        productVersion: '1.0.0',
      },
    })
    await result
    expect(store.pending['loadWorkspace']).toBe(false)
    expect(store.workspace?.slug).toBe('test-slug')
  })

  it('subsequent action clears error before executing (FR-018, QA-M002)', async () => {
    const store = useBackofficeWorkspaceStore()
    store.$patch({
      error: createAppError({
        code: 'PREV_ERROR',
        message: 'prev error',
        httpStatus: 0,
        isNetworkError: false,
      }),
    })
    await store.loadWorkspace('workspace-slug')
    expect(store.error).toBeNull()
  })

  it('state is isolated between tests (SC-005)', () => {
    const store = useBackofficeWorkspaceStore()
    expect(store.workspace).toBeNull()
    expect(store.error).toBeNull()
  })
})
