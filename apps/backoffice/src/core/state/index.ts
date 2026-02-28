import { createPinia } from 'pinia'
import { markRaw } from 'vue'
import type { Router } from 'vue-router'

export function createAppPinia(router: Router) {
  const pinia = createPinia()
  pinia.use(({ store }) => {
    store['router'] = markRaw(router)
  })
  return pinia
}
