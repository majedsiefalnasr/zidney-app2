---
name: ui-styling
description: Create beautiful, accessible user interfaces with shadcn-vue components (built on Reka UI + Tailwind CSS v4), Tailwind CSS utility-first styling, and canvas-based visual designs. Use when building Vue 3 user interfaces, implementing design systems, creating responsive layouts, adding accessible components (dialogs, dropdowns, forms, tables), customizing themes and colors, implementing dark mode, generating visual designs and posters, or establishing consistent styling patterns across applications.
argument-hint: "[component or layout]"
license: MIT
metadata:
  author: claudekit
  version: "2.0.0"
---

# UI Styling Skill

Comprehensive skill for creating beautiful, accessible user interfaces combining shadcn-vue components (Vue 3 port of shadcn/ui, built on Reka UI), Tailwind CSS v4 utility styling, and canvas-based visual design systems.

## Reference

- shadcn-vue: https://shadcn-vue.com/llms.txt
- Reka UI: https://reka-ui.com
- Tailwind CSS: https://tailwindcss.com/docs
- VueUse: https://vueuse.org

## When to Use This Skill

Use when:
- Building UI with Vue 3 frameworks (Vite, Nuxt)
- Implementing accessible components (dialogs, forms, tables, navigation)
- Styling with utility-first CSS approach (Tailwind CSS v4)
- Creating responsive, mobile-first layouts
- Implementing dark mode and theme customization
- Building design systems with consistent tokens
- Generating visual designs, posters, or brand materials
- Rapid prototyping with immediate visual feedback
- Adding complex UI patterns (data tables, charts, command palettes)

## Core Stack

### Component Layer: shadcn-vue
- Vue 3 port of shadcn/ui, built on Reka UI primitives
- Copy-paste distribution model (components live in your codebase)
- TypeScript-first with full type safety using Vue 3 `<script setup lang="ts">`
- Composable primitives for complex UIs via Reka UI
- CLI-based installation and management (`pnpm dlx shadcn-vue@latest`)

### Styling Layer: Tailwind CSS v4
- Utility-first CSS framework (v4 — CSS-native, no JS config required)
- Build-time processing with zero runtime overhead
- Mobile-first responsive design
- Consistent design tokens via CSS custom properties (`@theme`)
- Automatic dead code elimination

### Visual Design Layer: Canvas
- Museum-quality visual compositions
- Philosophy-driven design approach
- Sophisticated visual communication
- Minimal text, maximum visual impact
- Systematic patterns and refined aesthetics

## Quick Start

### Component + Styling Setup

**Install shadcn-vue with Tailwind:**
```bash
pnpm dlx shadcn-vue@latest init
```

CLI prompts for style (default/new-york), TypeScript, paths, and theme preferences. This configures both shadcn-vue and Tailwind CSS v4.

**Add components:**
```bash
pnpm dlx shadcn-vue@latest add button card dialog form
```

**Use components with utility styling:**
```vue
<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
</script>

<template>
  <div class="container mx-auto p-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
    <Card class="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle class="text-2xl font-bold">Analytics</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <p class="text-muted-foreground">View your metrics</p>
        <Button variant="default" class="w-full">
          View Details
        </Button>
      </CardContent>
    </Card>
  </div>
</template>
```

### Alternative: Tailwind-Only Setup

**Vite projects:**
```bash
npm install -D tailwindcss @tailwindcss/vite
```

```javascript
// vite.config.ts
import tailwindcss from '@tailwindcss/vite'
export default { plugins: [tailwindcss()] }
```

```css
/* src/index.css */
@import "tailwindcss";
```

## Component Library Guide

**Comprehensive component catalog with usage patterns, installation, and composition examples.**

See: `references/shadcn-components.md`

Covers:
- Form & input components (Button, Input, Select, Checkbox, Date Picker, Form validation)
- Layout & navigation (Card, Tabs, Accordion, Navigation Menu)
- Overlays & dialogs (Dialog, Drawer, Popover, Toast, Command)
- Feedback & status (Alert, Progress, Skeleton)
- Display components (Table, Data Table, Avatar, Badge)

## Theme & Customization

**Theme configuration, CSS variables, dark mode implementation, and component customization.**

See: `references/shadcn-theming.md`

Covers:
- Dark mode setup with next-themes
- CSS variable system
- Color customization and palettes
- Component variant customization
- Theme toggle implementation

## Accessibility Patterns

**ARIA patterns, keyboard navigation, screen reader support, and accessible component usage.**

See: `references/shadcn-accessibility.md`

Covers:
- Radix UI accessibility features
- Keyboard navigation patterns
- Focus management
- Screen reader announcements
- Form validation accessibility

## Tailwind Utilities

**Core utility classes for layout, spacing, typography, colors, borders, and shadows.**

See: `references/tailwind-utilities.md`

Covers:
- Layout utilities (Flexbox, Grid, positioning)
- Spacing system (padding, margin, gap)
- Typography (font sizes, weights, alignment, line height)
- Colors and backgrounds
- Borders and shadows
- Arbitrary values for custom styling

## Responsive Design

**Mobile-first breakpoints, responsive utilities, and adaptive layouts.**

See: `references/tailwind-responsive.md`

Covers:
- Mobile-first approach
- Breakpoint system (sm, md, lg, xl, 2xl)
- Responsive utility patterns
- Container queries
- Max-width queries
- Custom breakpoints

## Tailwind Customization

**Config file structure, custom utilities, plugins, and theme extensions.**

See: `references/tailwind-customization.md`

Covers:
- @theme directive for custom tokens
- Custom colors and fonts
- Spacing and breakpoint extensions
- Custom utility creation
- Custom variants
- Layer organization (@layer base, components, utilities)
- Apply directive for component extraction

## Visual Design System

**Canvas-based design philosophy, visual communication principles, and sophisticated compositions.**

See: `references/canvas-design-system.md`

Covers:
- Design philosophy approach
- Visual communication over text
- Systematic patterns and composition
- Color, form, and spatial design
- Minimal text integration
- Museum-quality execution
- Multi-page design systems

## Utility Scripts

**Python automation for component installation and configuration generation.**

### shadcn_add.py
Add shadcn-vue components with dependency handling:
```bash
pnpm dlx shadcn-vue@latest add button card dialog
```

### tailwind_config_gen.py
Generate tailwind.config.js with custom theme:
```bash
python scripts/tailwind_config_gen.py --colors brand:blue --fonts display:Inter
```

## Best Practices

1. **Component Composition**: Build complex UIs from simple, composable Reka UI primitives
2. **Utility-First Styling**: Use Tailwind v4 classes directly; extract components only for true repetition
3. **Mobile-First Responsive**: Start with mobile styles, layer responsive variants
4. **Accessibility-First**: Leverage Reka UI primitives, add focus states, use semantic HTML
5. **Design Tokens**: Use consistent CSS custom properties via `@theme`, avoid hardcoded values
6. **Dark Mode Consistency**: Apply dark variants to all themed elements
7. **Performance**: Leverage automatic CSS purging, avoid dynamic class names
8. **TypeScript**: Use `<script setup lang="ts">` with full type safety for props and emits
9. **Visual Hierarchy**: Let composition guide attention, use spacing and color intentionally
10. **Expert Craftsmanship**: Every detail matters - treat UI as a craft

## Reference Navigation

**Component Library**
- `references/shadcn-components.md` - Complete component catalog
- `references/shadcn-theming.md` - Theming and customization
- `references/shadcn-accessibility.md` - Accessibility patterns

**Styling System**
- `references/tailwind-utilities.md` - Core utility classes
- `references/tailwind-responsive.md` - Responsive design
- `references/tailwind-customization.md` - Configuration and extensions

**Visual Design**
- `references/canvas-design-system.md` - Design philosophy and canvas workflows

**Automation**
- `scripts/shadcn_add.py` - Component installation
- `scripts/tailwind_config_gen.py` - Config generation

## Common Patterns

**Form with validation (vee-validate + zod):**
```vue
<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const schema = toTypedSchema(z.object({
  email: z.string().email(),
  password: z.string().min(8)
}))

const { handleSubmit } = useForm({ validationSchema: schema })

const onSubmit = handleSubmit((values) => {
  console.log(values)
})
</script>

<template>
  <form @submit="onSubmit" class="space-y-6">
    <FormField v-slot="{ componentField }" name="email">
      <FormItem>
        <FormLabel>Email</FormLabel>
        <FormControl>
          <Input type="email" v-bind="componentField" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>
    <FormField v-slot="{ componentField }" name="password">
      <FormItem>
        <FormLabel>Password</FormLabel>
        <FormControl>
          <Input type="password" v-bind="componentField" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>
    <Button type="submit" class="w-full">Sign In</Button>
  </form>
</template>
```

**Responsive layout with dark mode:**
```vue
<template>
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <div class="container mx-auto px-4 py-8">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card class="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent class="p-6">
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
              Content
            </h3>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
```

## Resources

- shadcn-vue Docs: https://shadcn-vue.com
- Tailwind CSS Docs: https://tailwindcss.com
- Reka UI: https://reka-ui.com
- VueUse: https://vueuse.org
- vee-validate: https://vee-validate.logaretm.com
