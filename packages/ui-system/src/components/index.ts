// ===========================
// COMPONENTS BARREL EXPORT
// ===========================
// Tree-shakeable component exports

// Data Components
export { default as DataTable } from './DataTable/DataTable.vue'
export { default as RowActionButton } from './DataTable/RowActionButton.vue'
// Dialog Components
export { default as ConfirmDialog } from './Dialogs/ConfirmDialog.vue'
export { default as AdvancedFilterBuilder } from './Filters/AdvancedFilterBuilder.vue'
export { default as ColumnVisibilityDropdown } from './Filters/ColumnVisibilityDropdown.vue'
export { default as QuickFilterDropdown } from './Filters/QuickFilterDropdown.vue'
// Form Components
export { default as DrawerFormLayout } from './Forms/DrawerFormLayout.vue'
export { default as ModalFormLayout } from './Forms/ModalFormLayout.vue'
export { default as MultiLanguageInputModal } from './Forms/MultiLanguageInputModal.vue'
// Layout Components
export { default as AppLayout } from './Layout/AppLayout.vue'
export { default as SidebarLayout } from './Layout/SidebarLayout.vue'
export { default as TopBar } from './Layout/TopBar.vue'
// Status & Pagination Components
export { default as BadgeStatus } from './Status/BadgeStatus.vue'
export { default as EmptyState } from './Status/EmptyState.vue'
export { default as LoadingState } from './Status/LoadingState.vue'
export { default as PaginationBar } from './Status/PaginationBar.vue'
export { default as StatsCard } from './Status/StatsCard.vue'
export { default as StatusToggle } from './Status/StatusToggle.vue'

// shadcn-vue: Avatar
export { default as Avatar } from './shadcn-vue/avatar/Avatar.vue'
export { default as AvatarFallback } from './shadcn-vue/avatar/AvatarFallback.vue'
export { default as AvatarImage } from './shadcn-vue/avatar/AvatarImage.vue'
// shadcn-vue: Badge
export { default as Badge } from './shadcn-vue/badge/Badge.vue'
// shadcn-vue: Button
export { default as Button } from './shadcn-vue/button/Button.vue'
// shadcn-vue: DropdownMenu
export { default as DropdownMenu } from './shadcn-vue/dropdown-menu/DropdownMenu.vue'
export { default as DropdownMenuContent } from './shadcn-vue/dropdown-menu/DropdownMenuContent.vue'
export { default as DropdownMenuGroup } from './shadcn-vue/dropdown-menu/DropdownMenuGroup.vue'
export { default as DropdownMenuItem } from './shadcn-vue/dropdown-menu/DropdownMenuItem.vue'
export { default as DropdownMenuLabel } from './shadcn-vue/dropdown-menu/DropdownMenuLabel.vue'
export { default as DropdownMenuSeparator } from './shadcn-vue/dropdown-menu/DropdownMenuSeparator.vue'
export { default as DropdownMenuTrigger } from './shadcn-vue/dropdown-menu/DropdownMenuTrigger.vue'
// shadcn-vue: Form
export {
  FORM_ITEM_INJECTION_KEY,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormFieldArray,
  FormItem,
  FormLabel,
  FormMessage,
} from './shadcn-vue/form'
// shadcn-vue: Sonner (Toaster)
export { Toaster, toast } from './shadcn-vue/sonner'
