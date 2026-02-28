import type { Guard, GuardResult } from './auth.guard'

export const workspaceGuard: Guard = ({ to, authStore }): GuardResult => {
  if (!to.meta['requiresWorkspace']) return true
  const routeSlug = to.params['slug']
  if (
    typeof routeSlug === 'string' &&
    routeSlug === authStore.user?.workspaceSlug
  ) {
    return true
  }
  return { name: 'forbidden' }
}
