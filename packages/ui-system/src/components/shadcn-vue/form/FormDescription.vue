<script lang="ts" setup>
import type { HTMLAttributes } from 'vue'
import { useFormField } from './useFormField'

const _props = defineProps<{
  class?: HTMLAttributes['class']
}>()

const { formDescriptionId } = useFormField()
void [formDescriptionId]
</script>

<template>
  <p
    :id="formDescriptionId"
    data-slot="form-description"
    :class="cn('text-muted-foreground text-sm', props.class)"
  >
    <slot />
  </p>
</template>
