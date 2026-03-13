<template>
  <button
    :disabled="computedDisabled"
    :class="[
      'row-action-button',
      `row-action-button--${action.variant || 'primary'}`,
      { 'row-action-button--loading': isLoading },
      { 'row-action-button--error': showErrorState },
    ]"
    @click="handleClick"
    :title="action.label"
    :aria-busy="isLoading"
    :aria-label="`${action.label} for row ${rowId}`"
  >
    <span v-if="isLoading" class="row-action-button__spinner" />
    <span v-else-if="showErrorState" class="row-action-button__error-icon"
      >⚠</span
    >
    <span
      v-else-if="action.icon"
      class="row-action-button__icon"
      v-html="action.icon"
    />
    <span class="row-action-button__label">{{ action.label }}</span>
  </button>
</template>

<script setup lang="ts" generic="TRow extends Record<string, unknown>">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

export interface RowAction<TRow = unknown> {
  id: string
  label: string
  icon?: string
  callback: (row: TRow) => Promise<void>
  disabled?: boolean | ((row: TRow) => boolean)
  variant?: 'primary' | 'destructive'
}

export interface Props<TRow> {
  action: RowAction<TRow>
  row?: TRow
  isLoading?: boolean
  showError?: boolean
  rowId: string | number
  disabled?: boolean
}

export interface Emits<TRow> {
  execute: [row?: TRow]
}

const props = withDefaults(defineProps<Props<TRow>>(), {
  isLoading: false,
  showError: false,
  disabled: false,
})

const emit = defineEmits<Emits<TRow>>()

const showErrorState = ref(false)
const errorTimeoutId = ref<ReturnType<typeof setTimeout> | null>(null)
const isUnmounting = ref(false)

// Computed: Evaluate action.disabled if it's a function
const isActionDisabled = computed((): boolean => {
  if (!props.action.disabled) return false
  if (typeof props.action.disabled === 'boolean') return props.action.disabled
  return props.row ? props.action.disabled(props.row) : false
})

// Computed: combined disabled state (LOCKED DECISION 2: component-managed loading state)
const computedDisabled = computed(() => props.disabled || props.isLoading || isActionDisabled.value)

// Handlers: Execute action with error state management
const _handleClick = (): void => {
  if (computedDisabled.value || isUnmounting.value) return
  emit('execute', props.row)
}

// Watchers: Show error state for 2 seconds (LOCKED DECISION 2: error indicator for 2 seconds)
watch(
  () => props.showError,
  (newVal) => {
    if (newVal && !isUnmounting.value) {
      showErrorState.value = true

      // Clear existing timeout
      if (errorTimeoutId.value !== null) {
        clearTimeout(errorTimeoutId.value)
      }

      // Schedule error state clear (TIMEOUT GUARD: prevent state mutation after unmount)
      errorTimeoutId.value = setTimeout(() => {
        if (!isUnmounting.value) {
          showErrorState.value = false
        }
      }, 2000)
    }
  }
)

// Lifecycle: Cleanup on unmount (UNMOUNT SAFETY: no console errors, no memory leaks)
onBeforeUnmount(() => {
  isUnmounting.value = true
  if (errorTimeoutId.value !== null) {
    clearTimeout(errorTimeoutId.value)
  }
})
</script>

<style scoped>
@reference "tailwindcss";

.row-action-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 0.375rem 0.875rem;
  background-color: var(--color-white);
  border: 1px solid var(--color-gray-300);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  white-space: nowrap;
}

.row-action-button:hover:not(:disabled) {
  background-color: var(--color-gray-50);
  border-color: var(--color-gray-400);
}

.row-action-button:active:not(:disabled) {
  background-color: var(--color-gray-100);
}

.row-action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Variants */
.row-action-button--primary {
  color: var(--color-blue-600);
  border-color: var(--color-blue-300);
}

.row-action-button--primary:hover:not(:disabled) {
  background-color: var(--color-blue-50);
  border-color: var(--color-blue-400);
}

.row-action-button--destructive {
  color: var(--color-red-600);
  border-color: var(--color-red-300);
}

.row-action-button--destructive:hover:not(:disabled) {
  background-color: var(--color-red-50);
  border-color: var(--color-red-400);
}

.row-action-button--loading {
  color: var(--color-gray-500);
}

.row-action-button--error {
  color: var(--color-red-600);
  border-color: var(--color-red-400);
  background-color: var(--color-red-50);
}

/* Loading spinner */
.row-action-button__spinner {
  display: inline-block;
  width: 1em;
  height: 1em;
  border: 2px solid var(--color-gray-300);
  border-top-color: var(--color-gray-600);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Error icon */
.row-action-button__error-icon {
  font-size: 1.2em;
}

/* Icon slot */
.row-action-button__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Label */
.row-action-button__label {
  display: inline;
}
</style>
