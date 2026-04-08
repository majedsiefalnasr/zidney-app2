/**
 * Unit tests for apps/backoffice/src/components/OfflineBanner.vue
 *
 * Verifies:
 * - Banner renders when offline (showBanner=true)
 * - Banner absent when online (showBanner=false)
 * - role="status" present on banner element
 * - No dismiss/close button exposed
 *
 * Stage: STAGE_UI_08_NOTIFICATION_AND_FEEDBACK
 * Task: T031
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import OfflineBanner from '@/components/OfflineBanner.vue'

const mockIsOnline = ref(true)

vi.mock('@vueuse/core', () => ({
  useOnline: () => mockIsOnline,
}))

describe('OfflineBanner (backoffice)', () => {
  it('renders the banner when offline', async () => {
    mockIsOnline.value = false
    const wrapper = mount(OfflineBanner, {
      global: { stubs: { WifiOff: { template: '<span class="stub-wifi-off" />' } } },
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Connection lost')
  })

  it('does not render the banner when online', async () => {
    mockIsOnline.value = true
    const wrapper = mount(OfflineBanner, {
      global: { stubs: { WifiOff: { template: '<span class="stub-wifi-off" />' } } },
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('banner element has role="status" for accessibility', async () => {
    mockIsOnline.value = false
    const wrapper = mount(OfflineBanner, {
      global: { stubs: { WifiOff: { template: '<span class="stub-wifi-off" />' } } },
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })

  it('does not render a dismiss button', async () => {
    mockIsOnline.value = false
    const wrapper = mount(OfflineBanner, {
      global: { stubs: { WifiOff: { template: '<span class="stub-wifi-off" />' } } },
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
