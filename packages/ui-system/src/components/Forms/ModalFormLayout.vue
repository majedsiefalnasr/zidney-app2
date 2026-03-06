<template>
  <Dialog :open="isOpen" @update:open="isOpen ? undefined : $emit('cancel')">
    <DialogContent :class="`modal-${size}`">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
      </DialogHeader>
      <div class="modal-body">
        <slot />
      </div>
      <DialogFooter class="modal-footer">
        <Button variant="outline" @click="$emit('cancel')" :disabled="isLoading"
          >Cancel</Button
        >
        <Button
          :variant="submitVariant === 'destructive' ? 'destructive' : 'default'"
          @click="$emit('submit')"
          :disabled="isLoading"
          class="gap-2"
        >
          <Loader v-if="isLoading" class="w-4 h-4 animate-spin" />
          {{ submitLabel || 'Save' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from '@shadcn-vue/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shadcn-vue/ui/dialog'

interface Props {
  isOpen: boolean
  title: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  isLoading?: boolean
  submitLabel?: string
  submitVariant?: 'primary' | 'destructive'
}

interface Emits {
  submit: []
  cancel: []
}

withDefaults(defineProps<Props>(), {
  size: 'md',
  isLoading: false,
  submitVariant: 'primary',
})

defineEmits<Emits>()
</script>

<style scoped>
@reference "tailwindcss";

.modal-sm {
  @apply max-w-sm;
}
.modal-md {
  @apply max-w-md;
}
.modal-lg {
  @apply max-w-lg;
}
.modal-xl {
  @apply max-w-xl;
}
.modal-body {
  @apply py-4 px-0;
}
.modal-footer {
  @apply flex items-center justify-end gap-3;
}
</style>
