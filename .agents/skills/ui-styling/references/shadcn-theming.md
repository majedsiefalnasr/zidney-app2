# shadcn-vue Theming & Customization

Theme configuration, CSS variables, dark mode, and component customization for Vue 3 + shadcn-vue.

## Dark Mode Setup

### Vue 3 + VueUse (recommended)

**1. Install VueUse:**
```bash
pnpm add @vueuse/core
```

**2. Create a color mode composable:**
```ts
// composables/useTheme.ts
import { useColorMode } from '@vueuse/core'

export function useTheme() {
  const mode = useColorMode({
    attribute: 'class',
    modes: { light: 'light', dark: 'dark' }
  })
  return { mode }
}
```

**3. Theme toggle component:**
```vue
<!-- components/ThemeToggle.vue -->
<script setup lang="ts">
import { useColorMode } from '@vueuse/core'
import { Button } from '@/components/ui/button'

const mode = useColorMode()

function toggle() {
  mode.value = mode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <Button variant="ghost" size="icon" @click="toggle" aria-label="Toggle theme">
    <Sun v-if="mode === 'dark'" class="h-[1.2rem] w-[1.2rem]" />
    <Moon v-else class="h-[1.2rem] w-[1.2rem]" />
  </Button>
</template>
```

**4. Apply dark mode in main entry (`main.ts`):**

The `useColorMode` composable from VueUse handles `localStorage` persistence and system preference detection automatically. No manual setup required.

### Vite / Custom Solution

```ts
// Manually set dark class on mount
import { watchEffect } from 'vue'
import { usePreferredColorScheme, useStorage } from '@vueuse/core'

const systemScheme = usePreferredColorScheme()
const storedTheme = useStorage('theme', 'system')

watchEffect(() => {
  const isDark = storedTheme.value === 'dark' ||
    (storedTheme.value === 'system' && systemScheme.value === 'dark')
  document.documentElement.classList.toggle('dark', isDark)
})
```

## CSS Variable System

shadcn-vue uses CSS variables for theming. Variables defined in `globals.css` (Tailwind CSS v4 `@theme` block):

```css
@import "tailwindcss";

@theme {
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  --color-primary: oklch(0.205 0 0);
  --color-primary-foreground: oklch(0.985 0 0);
  --color-secondary: oklch(0.97 0 0);
  --color-secondary-foreground: oklch(0.205 0 0);
  --color-muted: oklch(0.97 0 0);
  --color-muted-foreground: oklch(0.556 0 0);
  --color-accent: oklch(0.97 0 0);
  --color-accent-foreground: oklch(0.205 0 0);
  --color-destructive: oklch(0.577 0.245 27.325);
  --color-border: oklch(0.922 0 0);
  --color-input: oklch(0.922 0 0);
  --color-ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}

.dark {
  --color-background: oklch(0.145 0 0);
  --color-foreground: oklch(0.985 0 0);
  --color-primary: oklch(0.985 0 0);
  --color-primary-foreground: oklch(0.205 0 0);
  --color-secondary: oklch(0.269 0 0);
  --color-secondary-foreground: oklch(0.985 0 0);
  --color-muted: oklch(0.269 0 0);
  --color-muted-foreground: oklch(0.708 0 0);
  --color-accent: oklch(0.269 0 0);
  --color-accent-foreground: oklch(0.985 0 0);
  --color-destructive: oklch(0.396 0.141 25.723);
  --color-border: oklch(1 0 0 / 10%);
  --color-input: oklch(1 0 0 / 15%);
  --color-ring: oklch(0.556 0 0);
}
```

### Legacy HSL format (pre-v4 compatibility)

If using Tailwind CSS v3 or an existing project, HSL CSS variables are also supported:
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --radius: 0.5rem;
}
```

## Tailwind CSS v4 Configuration

With Tailwind v4, there is no `tailwind.config.ts`. All theming uses the `@theme` directive in CSS:

```css
/* globals.css */
@import "tailwindcss";

@theme {
  /* Override design tokens */
  --color-primary: oklch(0.6 0.2 277);         /* brand purple */
  --color-primary-foreground: oklch(0.98 0 0);
  --font-sans: 'Inter', sans-serif;
  --radius: 0.375rem;
}
```

Tailwind v4 automatically generates utilities from all `@theme` tokens. No JS config needed.

## Color Customization

### Method 1: Update CSS Variables

Override colors in `globals.css`:

```css
@theme {
  --color-primary: oklch(0.55 0.22 275);   /* Purple */
  --color-primary-foreground: oklch(0.98 0 0);
}

.dark {
  --color-primary: oklch(0.65 0.2 275);
}
```

### Method 2: Theme Generator

Use shadcn-vue theme generator: https://shadcn-vue.com/themes

Select base color, generate theme, copy CSS variables.

### Method 3: Multiple White-Label Themes

Create theme variants with data attributes:

```css
[data-theme="violet"] {
  --color-primary: oklch(0.55 0.22 275);
  --color-primary-foreground: oklch(0.98 0 0);
}

[data-theme="rose"] {
  --color-primary: oklch(0.57 0.22 12);
  --color-primary-foreground: oklch(0.98 0 0);
}
```

Apply theme in Vue:
```vue
<template>
  <div data-theme="violet">
    <Button>Violet theme</Button>
  </div>
</template>
```

## Component Customization

Components live in your codebase (`components/ui/`) — modify them directly.

### Customize Variants (cva)

```ts
// components/ui/button.ts (or inline in button.vue)
import { cva } from 'class-variance-authority'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'border border-input bg-background',
        gradient: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        xl: 'h-14 rounded-md px-10 text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)
```

Usage in Vue template:
```vue
<Button variant="gradient" size="xl">Custom Button</Button>
```

### Override with class prop

Pass additional classes via `class` (not `className` — this is Vue):

```vue
<Card class="border-2 border-purple-500 shadow-2xl hover:scale-105 transition-transform">
  Custom styled card
</Card>
```

## Base Color Presets

shadcn-vue provides base color presets during `init`:

- **Slate**: Cool gray tones
- **Gray**: Neutral gray
- **Zinc**: Warm gray
- **Neutral**: Balanced gray
- **Stone**: Earthy gray

Select during setup or change later by updating CSS variables.

## Style Variants

Two component styles available:

- **Default**: Softer, more rounded
- **New York**: Sharp, more contrast

Select during `init` or in `components.json`:

```json
{
  "style": "new-york",
  "tailwind": {
    "cssVariables": true
  }
}
```

## Radius Customization

Control border radius globally via `@theme`:

```css
@theme {
  --radius: 0.5rem;   /* Default */
  /* --radius: 0rem; */ /* Sharp corners */
  /* --radius: 1rem; */ /* Rounded */
}
```

## Best Practices

1. **Use CSS Custom Properties**: Enables runtime theme switching without page reload
2. **Pair foreground colors**: Every `--color-X` needs a matching `--color-X-foreground`
3. **Test both themes**: Verify every component in light and dark modes
4. **Semantic naming**: Use `destructive`, `muted`, `accent` — not `red`, `gray`
5. **Accessibility**: Maintain WCAG AA contrast (4.5:1 for text, 3:1 for large text)
6. **class prop for overrides**: Use `:class` or `class` in Vue — never `className`
7. **Extract repeated patterns**: Create `cva` variants rather than repeating Tailwind strings
