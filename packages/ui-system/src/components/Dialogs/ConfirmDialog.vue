<template>
  <Dialog :open="isOpen" @update:open="isOpen ? undefined : $emit('cancel')">
    <DialogContent class="confirm-dialog max-w-sm">
      <!-- Warning icon -->
      <div class="text-4xl mb-4 text-center">⚠️</div>

      <!-- Title -->
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
      </DialogHeader>

      <!-- Message -->
      <p class="text-sm text-gray-600 text-center leading-relaxed m-0">
        {{ message }}
      </p>

      <!-- Buttons -->
      <DialogFooter class="flex gap-3 justify-center pt-4">
        <Button variant="outline" @click="$emit('cancel')">
          {{ cancelLabel || 'Cancel' }}
        </Button>
        <Button
          :variant="isDangerous ? 'destructive' : 'default'"
          @click="$emit('confirm')"
        >
          {{ confirmLabel || 'Confirm' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
interface Props {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  isDangerous?: boolean
}

interface Emits {
  confirm: []
  cancel: []
}

withDefaults(defineProps<Props>(), {
  isDangerous: false,
})

defineEmits<Emits>()
</script>

<style scoped>
@reference "tailwindcss";
/* Styles handled by shadcn-vue Dialog and Tailwind utilities */
</style>
