import type { RouteRecordRaw } from 'vue-router'

export const licensesRoutes: RouteRecordRaw[] = [
  {
    path: '/licenses',
    name: 'mmc-licenses',
    component: () => import('./views/LicenseListView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/licenses/:id',
    name: 'mmc-license-detail',
    component: () => import('./views/LicenseDetailView.vue'),
    meta: { requiresAuth: true },
  },
]
