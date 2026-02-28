/**
 * Backoffice App Entry Point — STAGE_17
 *
 * File: apps/backoffice/src/main.ts
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 *
 * Wires Vue 3 app with Pinia and Vue Router.
 * Context is loaded by the router navigation guard on first navigation.
 *
 * Constitutional Compliance:
 * ✓ createApp(App) → pinia → router → mount pattern
 * ✓ No credentials leak — context loaded via router guard (credentials: include)
 * ✓ contextStore.loadContext() is called by the router beforeEach guard,
 *   NOT directly here — prevents loading context before router history is ready
 */

import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
app.use(router)

// Mount after router is ready so navigation guards resolve on first load
router.isReady().then(() => {
  app.mount('#app')
})
