<script setup lang="ts">
/**
 * T084-T086: Error Message Display, License Search, License Table Pagination
 */

import { Button } from '@zidney/ui/components/shadcn-vue/button'
import { Input } from '@zidney/ui/components/shadcn-vue/input'
import { ref } from 'vue'

interface Props {
  searchPlaceholder?: string
}

withDefaults(defineProps<Props>(), {
  searchPlaceholder: 'Search licenses...',
})

const emit = defineEmits<{
  search: [query: string]
  filter: [status: string]
}>()

const searchQuery = ref('')
const selectedStatus = ref('all')

const handleSearch = () => {
  emit('search', searchQuery.value)
}

const handleFilter = (status: string) => {
  selectedStatus.value = status
  emit('filter', status)
}

const statuses = ['all', 'ACTIVE', 'SOFT_LOCKED', 'ARCHIVED', 'PENDING_PROVISION']
</script>

<template>
  <div class="space-y-4">
    <!-- Search bar -->
    <div class="flex gap-2">
      <Input
        v-model="searchQuery"
        :placeholder="searchPlaceholder"
        @keyup.enter="handleSearch"
        class="flex-1"
      />
      <Button @click="handleSearch">Search</Button>
    </div>

    <!-- Filter buttons -->
    <div class="flex gap-2 flex-wrap">
      <Button
        v-for="status in statuses"
        :key="status"
        :variant="selectedStatus === status ? 'default' : 'outline'"
        @click="handleFilter(status)"
        size="sm"
      >
        {{ status === 'all' ? 'All Licenses' : status }}
      </Button>
    </div>

    <!-- TODO: Add advanced filter panel when needed -->
  </div>
</template>
