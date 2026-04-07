/**
 * Unit tests for ErrorBoundary.vue
 * Stage: STAGE_UI_04_GLOBAL_ERROR_HANDLING
 * Task: T024
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'

import ErrorBoundary from '../ErrorBoundary.vue'

function makeRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes: [{ path: '/', component: { template: '<div/>' } }],
  })
}

/** Child that throws an error in onMounted — reliably triggers onErrorCaptured */
function ThrowingChild(message = 'test error') {
  return defineComponent({
    setup() {
      // Throw synchronously during render — caught by onErrorCaptured
      throw new Error(message)
    },
    render() {
      return h('div')
    },
  })
}

describe('ErrorBoundary', () => {
  it('renders default slot content when no error has occurred', () => {
    const wrapper = mount(ErrorBoundary, {
      global: { plugins: [makeRouter()] },
      slots: { default: '<span id="ok">ok</span>' },
    })
    expect(wrapper.find('#ok').exists()).toBe(true)
  })

  it('renders the default fallback UI when an error is captured', async () => {
    const wrapper = mount(ErrorBoundary, {
      global: { plugins: [makeRouter()] },
      slots: { default: ThrowingChild() },
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Something went wrong')
  })

  it('renders a named fallback slot when provided', async () => {
    const wrapper = mount(ErrorBoundary, {
      global: { plugins: [makeRouter()] },
      slots: {
        default: ThrowingChild(),
        fallback: '<p id="custom-fallback">Custom!</p>',
      },
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('#custom-fallback').exists()).toBe(true)
  })

  it('reset function clears capturedError', async () => {
    // Use a child that throws only on first render using a closure
    let callCount = 0
    const OnceThrowingChild = defineComponent({
      setup() {
        callCount++
        if (callCount === 1) throw new Error('first render error')
      },
      render() {
        return h('span', 'ok')
      },
    })
    const wrapper = mount(ErrorBoundary, {
      global: { plugins: [makeRouter()] },
      slots: { default: OnceThrowingChild },
    })
    await wrapper.vm.$nextTick()
    // Error captured from first render
    expect(wrapper.text()).toContain('Something went wrong')
    // Call reset directly on the vm — clears capturedError without re-triggering the child throw
    ;(wrapper.vm as unknown as { reset: () => void }).reset()
    expect((wrapper.vm as unknown as { capturedError: unknown }).capturedError).toBeNull()
  })

  it('calls logger.error when an error is captured', async () => {
    const logError = vi.fn()
    const wrapper = mount(ErrorBoundary, {
      global: {
        plugins: [makeRouter()],
        provide: { appLogger: { error: logError } as never, isProduction: false },
      },
      slots: { default: ThrowingChild('logged error') },
    })
    await wrapper.vm.$nextTick()
    expect(logError).toHaveBeenCalledOnce()
  })

  it('mounts without a logger provided (no crash)', async () => {
    const wrapper = mount(ErrorBoundary, {
      global: { plugins: [makeRouter()] },
      slots: { default: ThrowingChild() },
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.exists()).toBe(true)
  })
})
