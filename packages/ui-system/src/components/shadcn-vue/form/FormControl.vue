<script lang="ts" setup>
import { useFormField } from './useFormField'

const { error, formItemId, formDescriptionId, formMessageId } = useFormField()
void [error, formItemId, formDescriptionId, formMessageId]
</script>

<template>
  <Slot
    :id="formItemId"
    data-slot="form-control"
    :aria-describedby="
      !error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`
    "
    :aria-invalid="!!error"
  >
    <slot />
  </Slot>
</template>
