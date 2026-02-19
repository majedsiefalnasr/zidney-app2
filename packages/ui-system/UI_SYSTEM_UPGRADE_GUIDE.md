# UI System Refactoring Guide — shadcn-vue + Tailwind v4

## Enforcement Rules (MANDATORY)

This guide outlines the mandatory refactoring requirements for all Zidney UI components to comply with the new UI System Guard (Section 7 of AGENT_GOVERNANCE.md).

---

## 1. Base Component Pattern

### ✅ CORRECT — shadcn-vue Base + Tailwind

All components MUST extend shadcn-vue components, NOT raw HTML elements.

**DataTable.vue (Refactored Example):**

```vue
<template>
  <div class="flex flex-col gap-4">
    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-8">
      <div
        class="animate-spin size-8 border-4 border-gray-300 border-t-blue-600 rounded-full"
      />
    </div>

    <!-- Empty State -->
    <div v-else-if="displayedRows.length === 0" class="py-12 text-center">
      <p class="text-gray-500">No data available</p>
    </div>

    <!-- Table (Using shadcn-vue Table component) -->
    <div v-else class="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <!-- Selection Checkbox -->
            <TableHead v-if="enableRowSelection" class="w-12">
              <Checkbox
                :checked="allRowsSelected"
                @update:checked="handleSelectAll"
                aria-label="Select all rows"
              />
            </TableHead>

            <!-- Column Headers -->
            <TableHead
              v-for="column in visibleColumns"
              :key="column.id"
              :class="column.size ? `w-${column.size}` : ''"
            >
              <Button
                v-if="enableColumnSorting && column.enableSorting !== false"
                variant="ghost"
                size="sm"
                class="font-semibold"
                @click="handleSort(column.id)"
              >
                {{ column.header }}
                <ChevronUp
                  v-if="
                    sortState?.column === column.id &&
                    sortState.direction === 'asc'
                  "
                  class="ml-2 size-4"
                />
                <ChevronDown
                  v-else-if="
                    sortState?.column === column.id &&
                    sortState.direction === 'desc'
                  "
                  class="ml-2 size-4"
                />
              </Button>
              <span v-else class="font-semibold">{{ column.header }}</span>
            </TableHead>

            <!-- Actions Column Header -->
            <TableHead v-if="rowActions?.length" class="w-24">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <TableRow
            v-for="row in displayedRows"
            :key="getRowKey(row)"
            :class="[
              'cursor-pointer',
              isRowSelected(getRowKey(row)) ? 'bg-blue-50' : 'hover:bg-gray-50',
            ]"
          >
            <!-- Selection Checkbox -->
            <TableCell v-if="enableRowSelection" class="w-12">
              <Checkbox
                :checked="isRowSelected(getRowKey(row))"
                @update:checked="handleSelectRow(row)"
              />
            </TableCell>

            <!-- Data Cells -->
            <TableCell
              v-for="column in visibleColumns"
              :key="column.id"
              class="text-sm"
            >
              <component
                v-if="column.cell"
                :is="column.cell"
                :row="row"
                :column="column"
                :value="getCellValue(row, column)"
              />
              <span v-else class="text-gray-900">
                {{ getCellValue(row, column) }}
              </span>
            </TableCell>

            <!-- Row Actions -->
            <TableCell v-if="rowActions?.length" class="text-right">
              <div class="flex justify-end gap-2">
                <Button
                  v-for="action in rowActions"
                  :key="action.id"
                  :variant="action.variant || 'outline'"
                  size="sm"
                  :disabled="
                    isActionLoading(getRowKey(row), action.id) ||
                    action.disabled
                  "
                  @click="executeAction(row, action)"
                  :title="action.label"
                >
                  <Loader
                    v-if="isActionLoading(getRowKey(row), action.id)"
                    class="mr-2 size-4 animate-spin"
                  />
                  {{ action.label }}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Pagination -->
    <div
      v-if="paginationMode"
      class="flex items-center justify-between gap-4 py-4"
    >
      <Button
        variant="outline"
        size="sm"
        :disabled="currentPage <= 1"
        @click="handlePreviousPage"
      >
        Previous
      </Button>

      <span class="text-sm text-gray-600">
        Page {{ currentPage }} of {{ totalPages }}
      </span>

      <Button
        variant="outline"
        size="sm"
        :disabled="currentPage >= totalPages"
        @click="handleNextPage"
      >
        Next
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@zidney/shadcn-vue'
import {
  Button,
  Checkbox,
  ChevronUp,
  ChevronDown,
  Loader,
} from '@zidney/shadcn-vue'

interface Column {
  id: string
  header: string
  size?: string
  enableSorting?: boolean
  cell?: any
}

interface RowAction {
  id: string
  label: string
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive'
  disabled?: boolean
}

interface Props {
  rows: any[]
  columns: Column[]
  rowActions?: RowAction[]
  paginationMode?: 'server' | 'client' | false
  enableRowSelection?: boolean
  enableColumnSorting?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  paginationMode: false,
  enableRowSelection: true,
  enableColumnSorting: true,
  loading: false,
})

const emit = defineEmits<{
  sort: [columnId: string, direction: 'asc' | 'desc']
  selectRow: [rowKey: string, selected: boolean]
  selectAll: [selected: boolean]
  action: [rowKey: string, actionId: string]
}>()

// Component logic...
</script>

<style scoped>
/* Tailwind utilities only via @apply directive */
</style>
```

---

## 2. Styling Pattern

### ❌ WRONG — Custom CSS

```vue
<style>
.data-table {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
}

.data-table__header {
  background: #f3f4f6;
  padding: 0.5rem;
  border-radius: 0.25rem;
  cursor: pointer;
}

.data-table__skeleton {
  width: 100%;
  height: 40px;
  background: linear-gradient(90deg, #e5e7eb, #f3f4f6, #e5e7eb);
  border-radius: 0.25rem;
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}
</style>
```

### ✅ CORRECT — Tailwind Classes

```vue
<div class="flex flex-col gap-4 p-6 border rounded-lg">
  <!-- Skeleton with Tailwind animation -->
  <div class="w-full h-10 bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 rounded animate-pulse" />

  <!-- Button styled with Tailwind -->
  <Button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
    Click me
  </Button>
</div>
```

---

## 3. Component File Structure

```
src/components/
├── DataTable/
│   ├── index.ts
│   └── DataTable.vue
├── Forms/
│   ├── index.ts
│   ├── DrawerFormLayout.vue
│   ├── ModalFormLayout.vue
│   └── MultiLanguageInputModal.vue
├── Filters/
│   ├── index.ts
│   ├── AdvancedFilterBuilder.vue
│   ├── ColumnVisibilityDropdown.vue
│   └── QuickFilterDropdown.vue
├── Status/
│   ├── index.ts
│   ├── PaginationBar.vue
│   ├── StatsCard.vue
│   ├── StatusToggle.vue
│   ├── BadgeStatus.vue
│   ├── EmptyState.vue
│   └── LoadingState.vue
└── Dialogs/
    ├── index.ts
    └── ConfirmDialog.vue
```

**index.ts Pattern:**

```typescript
export { default as DataTable } from './DataTable.vue'
export type { Props as DataTableProps } from './DataTable.vue'
```

---

## 4. Form Component Pattern

### ✅ CORRECT — Using shadcn-vue Form

```vue
<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit Record</DialogTitle>
      </DialogHeader>

      <Form @submit="handleSubmit">
        <div class="space-y-4">
          <!-- Form Field with shadcn-vue FormField -->
          <FormField
            v-slot="{ componentField }"
            name="email"
            :rules="{ required: 'Email is required' }"
          >
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="Enter email"
                  v-bind="componentField"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <!-- Multi-language Select -->
          <FormField
            v-slot="{ componentField }"
            name="languages"
            :rules="{ required: 'Select at least one language' }"
          >
            <FormItem>
              <FormLabel>Languages</FormLabel>
              <FormControl>
                <Select v-bind="componentField">
                  <SelectTrigger>
                    <SelectValue placeholder="Select languages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>

        <DialogFooter class="mt-6">
          <Button
            type="button"
            variant="outline"
            @click="$emit('update:open', false)"
          >
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@zidney/shadcn-vue'

interface Props {
  open: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [data: any]
}>()

const handleSubmit = (data: any) => {
  emit('submit', data)
}
</script>

<style scoped>
/* Only Tailwind utilities via @apply if needed -->
.form-wrapper {
  @apply space-y-4 p-6;
}
</style>
```

---

## 5. Migration Checklist

For each component, verify:

- ✅ Uses shadcn-vue components (Button, Input, Dialog, Table, etc.)
- ✅ All styling uses Tailwind v4 classes
- ✅ No custom CSS outside `@apply` directive
- ✅ Styles are scoped to component
- ✅ No inline `style=` attributes
- ✅ All props fully typed (no `any` except for data)
- ✅ All events fully typed
- ✅ File structure follows shadcn-vue pattern
- ✅ Imports from `@zidney/shadcn-vue`
- ✅ No global CSS files for component styling

---

## 6. TypeScript Type Safety

### ✅ CORRECT — Fully Typed

```typescript
interface Column<T = any> {
  id: string
  header: string
  accessor?: keyof T
  cell?: (row: T) => VNode
  size?: string
  enableSorting?: boolean
}

interface RowAction {
  id: string
  label: string
  variant: 'primary' | 'secondary' | 'outline' | 'destructive'
  onClick: (row: any) => void | Promise<void>
  disabled?: boolean
}

interface Props<T = any> {
  rows: T[]
  columns: Column<T>[]
  rowActions?: RowAction[]
  onSort?: (columnId: string, direction: 'asc' | 'desc') => void
}

const emit = defineEmits<{
  sort: [columnId: string, direction: 'asc' | 'desc']
  action: [rowKey: string, actionId: string]
}>()
```

### ❌ WRONG — No Type Safety

```typescript
const props = defineProps({
  rows: Array,
  columns: Array,
  rowActions: Array,
})

const emit = defineEmits(['sort', 'action'])
```

---

## 7. Audit Validation

Before committing any component, run this validation:

```bash
# TypeScript strict check
pnpm type-check

# ESLint with vue-scoped-style rule
pnpm lint

# Build test
pnpm build

# Unit tests
pnpm test
```

If ANY check fails:

```
VERDICT: BLOCKED — Component fails validation
Fix required before merge
```

---

## 8. Component Examples

### Button Component (Minimal Wrapper)

```vue
<template>
  <shadcn-Button
    :variant="variant"
    :size="size"
    :disabled="disabled"
    :class="['custom-class']"
    v-bind="$attrs"
  >
    <slot />
  </shadcn-Button>
</template>

<script setup lang="ts">
import { Button as shadcn-Button } from '@zidney/shadcn-vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
})
</script>

<style scoped>
.custom-class {
  @apply font-semibold tracking-tight;
}
</style>
```

---

## 9. Enforcement Gates

Any pull request with UI components MUST pass:

1. **Type Safety Gate:**
   - ✅ Zero `any` types
   - ✅ All props typed
   - ✅ All events typed

2. **CSS Gate:**
   - ✅ Zero custom CSS outside `@apply`
   - ✅ All styles scoped
   - ✅ No inline `style=` attributes

3. **Component Gate:**
   - ✅ shadcn-vue base used
   - ✅ No custom components from scratch
   - ✅ Tailwind classes only

4. **Build Gate:**
   - ✅ `pnpm type-check` passes
   - ✅ `pnpm lint` passes
   - ✅ `pnpm build` succeeds
   - ✅ Bundle size < 25 kB

---

## 10. Reference

- **shadcn-vue:** https://www.shadcn-vue.com/
- **Tailwind v4:** https://tailwindcss.com/docs
- **Vue 3 Style Guide:** https://vuejs.org/style-guide/
- **Zidney Architecture:** `docs/architecture/ADR-*.md`
