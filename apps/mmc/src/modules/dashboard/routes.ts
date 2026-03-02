import type { RouteRecordRaw } from 'vue-router'

export const dashboardRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'mmc-dashboard',
    component: () => import('./views/DashboardView.vue'),
    meta: { requiresAuth: true },
  },
]
