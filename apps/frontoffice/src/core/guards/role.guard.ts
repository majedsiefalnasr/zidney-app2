import type { Guard, GuardResult } from './auth.guard'

export const roleGuard: Guard = ({ to, authStore }): GuardResult => {
  if (!to.meta['requiredRole']) return true
  if (authStore.user?.role === to.meta['requiredRole']) return true
  return { name: 'forbidden' }
}
