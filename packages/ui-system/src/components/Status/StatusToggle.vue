<template>
  <div class="flex items-center gap-3 cursor-pointer select-none">
    <Switch
      :checked="modelValue"
      :disabled="disabled"
      @update:checked="$emit('update:modelValue', $event)"
    />
    <span v-if="label" class="text-sm font-medium text-gray-900">{{
      label
    }}</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  disabled?: boolean
  label?: string
}

interface Emits {
  'update:modelValue': [value: boolean]
}

withDefaults(defineProps<Props>(), {
  disabled: false,
})

defineEmits<Emits>()
</script>

<style scoped>
@reference "tailwindcss";

/* Styles handled by shadcn-vue Switch and Tailwind utilities */
</style>
