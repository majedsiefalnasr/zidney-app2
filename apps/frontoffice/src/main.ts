// Step 1: Validate environment config at import time — throws early if misconfigured
import '@/core/config/env'

// Step 2: Static import of router (module-level)
import { router } from '@/core/router'

// Step 3: Import Pinia factory
import { createAppPinia } from '@/core/state'

// Step 4: Create Vue app
import { createApp } from 'vue'
import App from './App.vue'

const pinia = createAppPinia(router)
const app = createApp(App)

// Step 5: Register Pinia (must be before any store access)
app.use(pinia)

// Step 6: Register Router
app.use(router)

// Step 7: Mount
app.mount('#app')
