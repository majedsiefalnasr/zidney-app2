# Zidney UI System – Migration Guide

**Version:** 1.0.0 | **Target Apps:** MMC (m mc)

---

## Quick Start

### Installation

```bash
npm install @zidney/ui-system vue@^3.3 tailwindcss@^3
```

### Basic Setup

```vue
<template>
  <DataTable
    :rows="items"
    :columns="columns"
    :total-count="totalCount"
    pagination-mode="server"
    :pagination-state="paginationState"
    @pagination-changed="onPageChange"
  />
</template>

<script setup lang="ts">
import { DataTable } from "@zidney/ui-system";
import { ref } from "vue";

const items = ref([]);
const columns = [{ id: "name", header: "Name", accessor: "name" }];
const totalCount = ref(0);
const paginationState = ref({ currentPage: 1, pageSize: 10, totalCount: 0 });

const onPageChange = ({ page, pageSize }) => {
  fetchData(page, pageSize);
};

const fetchData = async (page, pageSize) => {
  const { data, total } = await api.getItems(page, pageSize);
  items.value = data;
  totalCount.value = total;
};
</script>
```

---

## Migration Patterns

### Pattern 1: Server-Side Pagination

**Old (custom table):**

```vue
<CustomTable :data="tableData" :loading="loading" />
<!-- Manual pagination handling -->
```

**New (shared DataTable):**

```vue
<DataTable
  :rows="users"
  :columns="userColumns"
  :total-count="totalUsers"
  pagination-mode="server"
  :pagination-state="paginationState"
  @pagination-changed="handlePageChange"
/>
```

**App responsibility:** Still manages API calls. DataTable is presentational.

---

### Pattern 2: Row Actions (Async-First)

**Old:**

```typescript
// Custom button with manual loading state
```

**New:**

```typescript
const deleteUser = async (user) => {
  await api.deleteUser(user.id);
};

const rowActions = [
  {
    id: "delete",
    label: "Delete",
    callback: deleteUser,
    variant: "destructive",
  },
];

// Component handles loading state, error display, 2s timeout
```

DataTable emits `@action-start` and `@action-end` for your refetch logic.

---

### Pattern 3: Filters with URL Sync

**Old:**

```typescript
// Manual filter state + URL management
```

**New:**

```typescript
const { filters, serializeFilters } = useFilterBuilder([]);

// Component serializes to URL automatically
// Overflow > 2000 chars? Falls back to localStorage
// App just needs to listen to @filter-changed
```

---

### Pattern 4: Multi-Language Forms

**Old:**

```vue
<!-- Separate form for each language -->
<form v-if="language === 'en'">...</form>
<form v-if="language === 'es'">...</form>
```

**New:**

```vue
<MultiLanguageInputModal
  :is-open="isOpen"
  :languages="['en', 'es']"
  :required-languages="['en']"
  @save="submitForm"
/>
```

Enforces: Min 1 required language (LOCKED DECISION 5).

---

## Best Practices

### ✅ DO:

1. **Manage API calls in parent:**

   ```typescript
   const handlePageChange = async (event) => {
     const data = await api.getPage(event.page);
     items.value = data;
   };
   ```

2. **Use server mode for large datasets:**

   ```typescript
   pagination-mode="server" // Only render current page
   ```

3. **Provide unique row keys:**

   ```typescript
   :row-key="row => row.id" // or string 'id'
   ```

4. **Validate in composables, render in components:**
   ```typescript
   const { isValid } = useMultiLanguageForm([...])
   // Use isValid to disable submit button
   ```

### ❌ DON'T:

1. **Don't embed API calls in components**

   ```typescript
   // ❌ BAD
   <DataTable @pagination-changed="fetch({ ...state })" />
   ```

2. **Don't use client mode for > 500 rows**

   ```typescript
   pagination-mode="client" // Slows down render
   ```

3. **Don't mutate form data directly**

   ```typescript
   // ❌ BAD
   emittedData.name = "modified"; // Parent should clone
   ```

4. **Don't skip required language validation**
   ```typescript
   // ❌ BAD
   requiredLanguages: []; // Always enforce at least 1
   ```

---

## Real-World Examples

### Example 1: Audit Logs (Task 12A)

```vue
<template>
  <DataTable
    :rows="auditLogs"
    :columns="columns"
    :total-count="totalLogs"
    pagination-mode="server"
    :pagination-state="paginationState"
    @pagination-changed="onPageChange"
    @sort-changed="onSortChange"
  />
</template>

<script setup lang="ts">
import { ref } from "vue";
import { DataTable } from "@zidney/ui-system";

const auditLogs = ref([]);
const paginationState = ref({ currentPage: 1, pageSize: 10, totalCount: 0 });

const columns = [
  { id: "timestamp", header: "Time", accessor: "createdAt" },
  { id: "user", header: "User", accessor: "user.name" },
  { id: "action", header: "Action", accessor: "action" },
  { id: "status", header: "Status", accessor: "status" },
];

const onPageChange = async (event) => {
  const { data, total } = await api.getAuditLogs(event.page, event.pageSize);
  auditLogs.value = data;
  paginationState.value.totalCount = total;
};

const onSortChange = async (event) => {
  const { data } = await api.getAuditLogs(1, 10, {
    sortBy: event.column,
    sortDir: event.direction,
  });
  auditLogs.value = data;
  paginationState.value.currentPage = 1;
};
</script>
```

### Example 2: Licenses with Filters & Row Actions (Task 12B)

```vue
<template>
  <div>
    <AdvancedFilterBuilder
      :filters="filters"
      :available-fields="filterFields"
      @filter-changed="onFiltersChange"
    />
    <DataTable
      :rows="licenses"
      :columns="columns"
      :total-count="totalLicenses"
      pagination-mode="server"
      :pagination-state="paginationState"
      :row-actions="rowActions"
      @pagination-changed="onPageChange"
      @action-end="onActionEnd"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { DataTable, AdvancedFilterBuilder } from "@zidney/ui-system";

const licenses = ref([]);
const filters = ref([]);
const filterFields = [
  {
    id: "status",
    label: "Status",
    type: "select",
    operators: ["equals"],
    options: [{ value: "active", label: "Active" }],
  },
];

const columns = [{ id: "name", header: "License", accessor: "name" }];

const rowActions = [
  { id: "view", label: "View", callback: viewLicense },
  { id: "edit", label: "Edit", callback: editLicense },
  {
    id: "archive",
    label: "Archive",
    callback: archiveLicense,
    variant: "destructive",
  },
];

const onFiltersChange = async (event) => {
  filters.value = event.filters;
  // Re-fetch with new filters
  const { data } = await api.getLicenses(1, 10, filters.value);
  licenses.value = data;
};

const viewLicense = async (license) => {
  await api.viewLicense(license.id);
};

const onActionEnd = (event) => {
  if (event.success) {
    // Re-fetch list after action
    loadLicenses();
  }
};
</script>
```

### Example 3: Users with Multi-Language Forms (Task 12C)

```vue
<template>
  <DataTable
    :rows="users"
    :columns="columns"
    :row-actions="[{ id: 'edit', label: 'Edit', callback: openEditForm }]"
  />

  <ModalFormLayout :is-open="isEditOpen" title="Edit User" size="lg" @submit="submitUserForm">
    <MultiLanguageInputModal
      :languages="['en', 'es', 'fr']"
      :required-languages="['en']"
      :validation-rules="{
        en: [{ type: 'required', message: 'Required' }],
      }"
      @save="onMultiLangSave"
    />
  </ModalFormLayout>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { DataTable, ModalFormLayout, MultiLanguageInputModal } from "@zidney/ui-system";
import { useMultiLanguageForm } from "@zidney/ui-system/composables";

const users = ref([]);
const isEditOpen = ref(false);
const editingUser = ref(null);

const { getAllValues, isValid } = useMultiLanguageForm(["en", "es", "fr"], "en");

const openEditForm = async (user) => {
  editingUser.value = user;
  isEditOpen.value = true;
};

const submitUserForm = async () => {
  if (!isValid.value) return;
  const values = getAllValues();
  await api.updateUser(editingUser.value.id, values);
  isEditOpen.value = false;
  loadUsers();
};
</script>
```

---

## Performance Tips

1. **Use column accessors efficiently:**

   ```typescript
   // ✅ Good: Direct property
   { id: 'name', accessor: 'name' }
   // ✅ Good: Nested with dot notation
   { id: 'userEmail', accessor: 'user.email' }
   // ⚠️ Avoid: Complex compute in accessor
   { id: 'fullName', accessor: row => `${row.first} ${row.last}` } // Use renderCell instead
   ```

2. **Memoize column definitions:**

   ```typescript
   const columns = useMemo(() => [...], [])
   ```

3. **Use client mode only for < 100 rows:**
   ```typescript
   pagination-mode="client"
   ```

---

## Troubleshooting

| Issue                          | Solution                                                |
| ------------------------------ | ------------------------------------------------------- |
| Types not resolving            | Import from '@zidney/ui-system/types'                   |
| Form data mutated after submit | Clone data: `JSON.parse(JSON.stringify(data))`          |
| Filter URL too long            | Falls back to localStorage (automatic)                  |
| Row action callback slow       | Timeout is 2s; ensure API is fast                       |
| Column headers not visible     | Check enableColumnSorting, enableColumnVisibility props |

---

**For API reference, see:** [COMPONENT_API.md](./COMPONENT_API.md)
