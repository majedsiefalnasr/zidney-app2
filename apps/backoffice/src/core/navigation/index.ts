/**
 * Backoffice Navigation Configuration
 * Defines the navigation structure for the Backoffice tenant admin panel.
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 */

/**
 * A single navigation item referencing a named route.
 * Items with unmet permissions are hidden (not disabled).
 */
export interface NavigationItem {
  /** Named route (must exist in this app's router) */
  routeName: string
  /** Display label (may be i18n key or raw string) */
  label: string
  /** Lucide icon name from @zidney/ui-system icon set */
  icon?: string
  /** Permission key — looked up in auth.store.resolvedPermissions */
  permission?: string
  /** Nested items (max 1 level deep) */
  children?: NavigationItem[]
}

/**
 * A group of navigation items with an optional section heading.
 */
export interface NavigationGroup {
  /** Optional group section label */
  label?: string
  items: NavigationItem[]
}

/**
 * Full navigation configuration for the app.
 * Type alias: array of NavigationGroup entries.
 */
export type NavigationConfig = NavigationGroup[]

export const navigationConfig: NavigationConfig = [
  {
    label: 'Management',
    items: [
      {
        routeName: 'bo-dashboard',
        label: 'Dashboard',
        icon: 'LayoutDashboard',
      },
      {
        routeName: 'bo-exams',
        label: 'Exams',
        icon: 'FileText',
        permission: 'exam.list',
      },
    ],
  },
]
