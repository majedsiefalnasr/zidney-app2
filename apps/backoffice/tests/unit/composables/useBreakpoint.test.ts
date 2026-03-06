/**
 * Unit tests for apps/backoffice/src/composables/useBreakpoint.ts
 *
 * Verifies:
 * - setMobile(true) called on mount when window.innerWidth < 768
 * - setMobile(false) called on mount when window.innerWidth >= 768
 * - setMobile called when resize event fires and crosses threshold
 * - resize event listener removed on unmount (no memory leak)
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 * Task: T038
 */
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useBackofficeUiStore } from '@/core/state/ui.store'
import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

const TestComponent = defineComponent({
  setup() {
    useBreakpoint()
    return {}
  },
  template: '<div />',
})

describe('useBreakpoint (backoffice)', () => {
  let pinia: ReturnType<typeof createTestingPinia>

  beforeEach(() => {
    pinia = createTestingPinia({ createSpy: vi.fn })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls setMobile(true) on mount when window.innerWidth is 767', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 767,
    })
    const wrapper = mount(TestComponent, { global: { plugins: [pinia] } })
    const store = useBackofficeUiStore()
    expect(store.setMobile).toHaveBeenCalledWith(true)
    wrapper.unmount()
  })

  it('calls setMobile(false) on mount when window.innerWidth is 768', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    })
    const wrapper = mount(TestComponent, { global: { plugins: [pinia] } })
    const store = useBackofficeUiStore()
    expect(store.setMobile).toHaveBeenCalledWith(false)
    wrapper.unmount()
  })

  it('calls setMobile when a resize event fires below threshold', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })
    const wrapper = mount(TestComponent, { global: { plugins: [pinia] } })
    const store = useBackofficeUiStore()

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    })
    window.dispatchEvent(new Event('resize'))

    expect(store.setMobile).toHaveBeenCalledWith(false)
    expect(store.setMobile).toHaveBeenCalledWith(true)
    wrapper.unmount()
  })

  it('removes the resize listener on unmount (no memory leak)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })
    const spy = vi.spyOn(window, 'removeEventListener')
    const wrapper = mount(TestComponent, { global: { plugins: [pinia] } })
    wrapper.unmount()
    expect(spy).toHaveBeenCalledWith('resize', expect.any(Function))
  })
})
