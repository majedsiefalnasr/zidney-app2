<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { ButtonVariants } from '@/registry/new-york-v4/ui/button'
import type { InputGroupButtonVariants } from '.'

interface InputGroupButtonProps {
  variant?: ButtonVariants['variant']
  size?: InputGroupButtonVariants['size']
  class?: HTMLAttributes['class']
}

const _props = withDefaults(defineProps<InputGroupButtonProps>(), {
  size: 'xs',
  variant: 'ghost',
})
</script>

<template>
  <Button
    :data-size="props.size"
    :variant="props.variant"
    :class="cn(inputGroupButtonVariants({ size: props.size }), props.class)"
  >
    <slot />
  </Button>
</template>
