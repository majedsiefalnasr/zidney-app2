<template>
  <Dialog :open="isOpen" @update:open="isOpen ? undefined : $emit('cancel')">
    <DialogContent class="modal-language max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <div class="coverage-bar mt-2">
          <div
            class="coverage-fill"
            :style="{ width: coveragePercent + '%' }"
          />
        </div>
        <p class="coverage-text text-xs text-gray-500 mt-1">
          {{ filledLanguagesCount }} / {{ languages.length }} languages filled
        </p>
      </DialogHeader>

      <div class="language-tabs flex flex-wrap gap-2 py-3 border-y">
        <Button
          v-for="lang in filteredLanguages"
          :key="lang"
          :variant="activeLanguage === lang ? 'default' : 'outline'"
          :class="{ 'border-green-500 bg-green-50': formValues[lang]?.trim() }"
          @click="activeLanguage = lang"
          size="sm"
        >
          {{ lang }}
          <span v-if="requiredLanguages.includes(lang)" class="ml-1">*</span>
        </Button>
      </div>

      <div class="language-content space-y-2 mt-4">
        <Input
          v-if="!isMultiline"
          v-model="formValues[activeLanguage]"
          :placeholder="`Enter text in ${activeLanguage}...`"
          @input="validateLanguage(activeLanguage)"
        />
        <Textarea
          v-else
          v-model="formValues[activeLanguage]"
          :placeholder="`Enter text in ${activeLanguage}...`"
          class="min-h-32"
          @input="validateLanguage(activeLanguage)"
        />
        <div v-if="languageErrors[activeLanguage]" class="space-y-1 mt-2">
          <p
            v-for="(error, idx) in languageErrors[activeLanguage]"
            :key="idx"
            class="text-sm text-red-500"
          >
            {{ error }}
          </p>
        </div>
      </div>

      <DialogFooter class="mt-6">
        <Button variant="outline" @click="$emit('cancel')" :disabled="isLoading"
          >Cancel</Button
        >
        <Button
          @click="$emit('submit')"
          :disabled="isLoading || !isValid"
          class="gap-2"
        >
          <Loader v-if="isLoading" class="w-4 h-4 animate-spin" />
          Save All Languages
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
import { Input } from '@shadcn-vue/ui/input'
import { Textarea } from '@shadcn-vue/ui/textarea'
import { computed, ref, watch } from 'vue'

interface Props {
  isOpen: boolean
  title: string
  languages: string[]
  requiredLanguages?: string[]
  isLoading?: boolean
  isMultiline?: boolean
  initialValues?: Record<string, string>
  minLength?: number
  maxLength?: number
}

const props = withDefaults(defineProps<Props>(), {
  requiredLanguages: () => [],
  isLoading: false,
  isMultiline: true,
  minLength: 1,
  maxLength: 500,
})

const emit = defineEmits<{
  submit: []
  cancel: []
}>()

const activeLanguage = ref('')
const formValues = ref<Record<string, string>>({})
const languageErrors = ref<Record<string, string[]>>({})

const filteredLanguages = computed(() => props.languages)

const filledLanguagesCount = computed(
  () => props.languages.filter((lang) => formValues.value[lang]?.trim()).length
)

const coveragePercent = computed(() =>
  props.languages.length > 0
    ? Math.round((filledLanguagesCount.value / props.languages.length) * 100)
    : 0
)

const isValid = computed(() => {
  if (props.languages.length === 0) return false
  for (const lang of props.requiredLanguages) {
    if (!formValues.value[lang]?.trim()) return false
  }
  return Object.values(languageErrors.value).flat().length === 0
})

const validateLanguage = (lang: string) => {
  const errors: string[] = []
  const value = formValues.value[lang]

  if (props.requiredLanguages.includes(lang) && !value?.trim()) {
    errors.push(`${lang} is required`)
  }
  if (value && value.length < props.minLength) {
    errors.push(`Minimum ${props.minLength} characters`)
  }
  if (value && value.length > props.maxLength) {
    errors.push(`Maximum ${props.maxLength} characters`)
  }

  languageErrors.value[lang] = errors
}

watch(
  () => props.isOpen,
  (newIsOpen) => {
    if (newIsOpen) {
      formValues.value = props.initialValues
        ? { ...props.initialValues }
        : props.languages.reduce((acc, lang) => ({ ...acc, [lang]: '' }), {})
      activeLanguage.value = props.languages[0] || ''
      for (const lang of props.languages) {
        validateLanguage(lang)
      }
    }
  }
)
</script>

<style scoped>
@reference "tailwindcss";

.coverage-bar {
  @apply w-full h-2 bg-gray-200 rounded-full overflow-hidden;
}

.coverage-fill {
  @apply h-full bg-blue-500 transition-all duration-300;
}

.multi-language-input-modal {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
}

.multi-language-input-modal--open {
  pointer-events: auto;
  opacity: 1;
}

.multi-language-input-modal__backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  animation: fadeIn 0.2s;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.multi-language-input-modal__modal {
  position: relative;
  z-index: 50;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  width: min(100%, 600px);
  max-height: 90vh;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(2rem);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.multi-language-input-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-lg);
  border-bottom: 1px solid var(--color-gray-200);
}

.multi-language-input-modal__title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-gray-900);
}

.multi-language-input-modal__coverage {
  margin-top: var(--space-md);
}

.multi-language-input-modal__coverage-bar {
  height: 6px;
  background-color: var(--color-gray-200);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.multi-language-input-modal__coverage-fill {
  height: 100%;
  background-color: var(--color-green-500);
  transition: width 0.3s;
}

.multi-language-input-modal__coverage-text {
  font-size: var(--font-size-xs);
  color: var(--color-gray-600);
  font-weight: 500;
}

.multi-language-input-modal__close {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.5rem;
  color: var(--color-gray-500);
  transition: color 0.15s;
}

.multi-language-input-modal__close:hover {
  color: var(--color-gray-900);
}

.multi-language-input-modal__content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: var(--space-lg);
  background-color: var(--color-gray-50);
}

.multi-language-input-modal__search {
  margin-bottom: var(--space-md);
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-gray-300);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}

.multi-language-input-modal__search:focus {
  outline: none;
  border-color: var(--color-blue-500);
  box-shadow: 0 0 0 3px var(--color-blue-50);
}

.multi-language-input-modal__tabs {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
  overflow-x: auto;
  padding-bottom: var(--space-sm);
}

.multi-language-input-modal__tab {
  padding: 0.5rem 1rem;
  background-color: var(--color-white);
  border: 1px solid var(--color-gray-300);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.15s;
  position: relative;
}

.multi-language-input-modal__tab:hover {
  border-color: var(--color-gray-400);
}

.multi-language-input-modal__tab--active {
  background-color: var(--color-blue-600);
  color: white;
  border-color: var(--color-blue-600);
}

.multi-language-input-modal__tab--required::after {
  content: '*';
  color: var(--color-red-500);
  margin-left: 0.25rem;
}

.multi-language-input-modal__tab--filled {
  background-color: var(--color-green-50);
  border-color: var(--color-green-300);
}

.multi-language-input-modal__tab--active.multi-language-input-modal__tab--filled {
  background-color: var(--color-blue-600);
}

.multi-language-input-modal__required {
  color: var(--color-red-500);
  margin-left: 0.25rem;
}

.multi-language-input-modal__language-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.multi-language-input-modal__textarea {
  width: 100%;
  min-height: 200px;
  padding: var(--space-md);
  border: 1px solid var(--color-gray-300);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-family: inherit;
  resize: vertical;
}

.multi-language-input-modal__textarea:focus {
  outline: none;
  border-color: var(--color-blue-500);
  box-shadow: 0 0 0 3px var(--color-blue-50);
}

.multi-language-input-modal__errors {
  padding: var(--space-md);
  background-color: var(--color-red-50);
  border: 1px solid var(--color-red-200);
  border-radius: var(--radius-sm);
}

.error-message {
  margin: 0;
  color: var(--color-red-700);
  font-size: var(--font-size-xs);
}

.error-message + .error-message {
  margin-top: 0.5rem;
}

.multi-language-input-modal__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-md);
  padding: var(--space-lg);
  border-top: 1px solid var(--color-gray-200);
  background-color: var(--color-gray-50);
}

.multi-language-input-modal__btn {
  padding: 0.625rem 1.25rem;
  border: 1px solid var(--color-gray-300);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.multi-language-input-modal__btn--cancel {
  background-color: var(--color-white);
  color: var(--color-gray-900);
}

.multi-language-input-modal__btn--cancel:hover {
  background-color: var(--color-gray-100);
}

.multi-language-input-modal__btn--submit {
  background-color: var(--color-blue-600);
  color: white;
  border-color: var(--color-blue-600);
}

.multi-language-input-modal__btn--submit:not(
    .multi-language-input-modal__btn--submit-disabled
  ):hover {
  background-color: var(--color-blue-700);
}

.multi-language-input-modal__btn--submit-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
