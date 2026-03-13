<script lang="ts" setup>
import type { HTMLAttributes } from 'vue'
import { useFormField } from './useFormField'

const _props = defineProps<{
  class?: HTMLAttributes['class']
}>()

const { name, formMessageId } = useFormField()
void [name, formMessageId]
</script>

<template>
  <ErrorMessage
    :id="formMessageId"
    data-slot="form-message"
    as="p"
    :name="toValue(name)"
    :class="cn('text-destructive text-sm', props.class)"
  />
</template>
