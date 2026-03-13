<script setup lang="ts">
import type { SplitterPanelEmits, SplitterPanelProps } from 'reka-ui'
import { useForwardExpose, useForwardPropsEmits } from 'reka-ui'

const props = defineProps<SplitterPanelProps>()
const emits = defineEmits<SplitterPanelEmits>()

const _forwarded = useForwardPropsEmits(props, emits)
const { forwardRef } = useForwardExpose()
// Mark forwarded as used for the template binding
void _forwarded
// Ensure `forwardRef` is considered used by the linter (referenced in template)
void forwardRef
</script>

<template>
  <SplitterPanel
    :ref="forwardRef"
    v-slot="slotProps"
    data-slot="resizable-panel"
    v-bind="_forwarded"
  >
    <slot v-bind="slotProps" />
  </SplitterPanel>
</template>
