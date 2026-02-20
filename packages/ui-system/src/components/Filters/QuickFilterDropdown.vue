<template>
  <div class="quick-filter-dropdown relative w-full max-w-sm">
    <Input
      v-model="localQuery"
      type="text"
      :placeholder="placeholder"
      @input="handleInput"
      @focus="showSuggestions = true"
      @blur="hideSuggestionsLater"
    />

    <!-- Suggestions dropdown -->
    <div
      v-if="showSuggestions && suggestions && suggestions.length > 0"
      class="suggestions-dropdown absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-md max-h-48 overflow-y-auto z-10"
    >
      <button
        v-for="suggestion in suggestions"
        :key="suggestion"
        @click="selectSuggestion(suggestion)"
        @mousedown="preventBlur"
        class="suggestion-item"
      >
        {{ suggestion }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Input } from '@zidney/shadcn-vue'
import { ref, watch } from 'vue'

interface Props {
  query?: string
  placeholder?: string
  suggestions?: string[]
  debounceMs?: number
}

interface Emits {
  'query-changed': [query: string]
  'suggestion-selected': [value: string]
}

const props = withDefaults(defineProps<Props>(), {
  query: '',
  placeholder: 'Search...',
  debounceMs: 300,
})

const emit = defineEmits<Emits>()

const localQuery = ref(props.query)
const showSuggestions = ref(false)
let debounceTimeoutId: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.query,
  (newQuery) => {
    localQuery.value = newQuery
  }
)

const handleInput = (): void => {
  if (debounceTimeoutId !== null) {
    clearTimeout(debounceTimeoutId)
  }

  debounceTimeoutId = setTimeout(() => {
    emit('query-changed', localQuery.value)
  }, props.debounceMs)
}

const selectSuggestion = (suggestion: string): void => {
  localQuery.value = suggestion
  emit('suggestion-selected', suggestion)
  emit('query-changed', suggestion)
  showSuggestions.value = false
}

const preventBlur = (event: MouseEvent): void => {
  event.preventDefault()
}

const hideSuggestionsLater = (): void => {
  setTimeout(() => {
    showSuggestions.value = false
  }, 100)
}
</script>

<style scoped>
.suggestion-item {
  @apply block w-full px-4 py-2 text-left text-sm bg-transparent border-none cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors;
}
</style>
