<template>
  <Drawer :open="isOpen" @update:open="$emit('close')">
    <DrawerContent class="drawer-content">
      <!-- Header -->
      <DrawerHeader class="drawer-header">
        <div>
          <DrawerTitle>{{ title }}</DrawerTitle>
          <p v-if="subtitle" class="drawer-subtitle">{{ subtitle }}</p>
        </div>
      </DrawerHeader>

      <!-- Content -->
      <div class="drawer-body">
        <slot />
      </div>

      <!-- Footer -->
      <DrawerFooter class="drawer-footer">
        <slot name="footer">
          <Button
            variant="outline"
            @click="$emit('cancel')"
            :disabled="isLoading"
          >
            Cancel
          </Button>
          <Button
            @click="$emit('submit')"
            :disabled="isLoading || !isDirty"
            class="gap-2"
          >
            <Loader v-if="isLoading" class="w-4 h-4 animate-spin" />
            {{ submitLabel || 'Save' }}
          </Button>
        </slot>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
</template>

<script setup lang="ts">
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Loader,
} from '@zidney/shadcn-vue'

interface Props {
  isOpen: boolean
  title: string
  subtitle?: string
  isLoading?: boolean
  submitLabel?: string
  cancelLabel?: string
  isDirty?: boolean
}

interface Emits {
  submit: []
  cancel: []
  close: []
}

withDefaults(defineProps<Props>(), {
  isLoading: false,
  isDirty: true,
})

defineEmits<Emits>()
</script>

<style scoped>
.drawer-content {
  @apply p-6;
}

.drawer-header {
  @apply flex items-start justify-between gap-4 mb-4;
}

.drawer-subtitle {
  @apply text-sm text-gray-500 mt-1;
}

.drawer-body {
  @apply flex-1 overflow-y-auto py-4;
}

.drawer-footer {
  @apply flex items-center justify-end gap-3 mt-6 pt-4 border-t;
}
</style>
