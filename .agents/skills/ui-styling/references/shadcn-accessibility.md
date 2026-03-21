# shadcn-vue Accessibility Patterns

ARIA patterns, keyboard navigation, screen reader support, and accessible component usage for Vue 3 + shadcn-vue.

## Foundation: Reka UI Primitives

shadcn-vue built on Reka UI primitives — unstyled, accessible Vue 3 components following WAI-ARIA design patterns.

Benefits:
- Keyboard navigation built-in
- Screen reader announcements
- Focus management
- ARIA attributes automatically applied
- Tested against accessibility standards

## Keyboard Navigation

### Focus Management

**Focus visible states:**
```vue
<template>
  <Button class="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
    Accessible Button
  </Button>
</template>
```

**Skip to content:**
```vue
<template>
  <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2">
    Skip to content
  </a>

  <main id="main-content">
    <!-- Content -->
  </main>
</template>
```

### Dialog/Modal Navigation

Dialogs trap focus automatically via Reka UI Dialog primitive:

```vue
<script setup lang="ts">
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
</script>

<template>
  <Dialog>
    <DialogTrigger>Open</DialogTrigger>
    <DialogContent>
      <!-- Focus trapped here -->
      <input />  <!-- Auto-focused -->
      <Button>Action</Button>
      <!-- Esc to close, Tab to navigate -->
    </DialogContent>
  </Dialog>
</template>
```

Features:
- Focus trapped within dialog
- Esc key closes
- Tab cycles through focusable elements
- Focus returns to trigger on close

### Dropdown/Menu Navigation

```vue
<script setup lang="ts">
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger>Open</DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem>Profile</DropdownMenuItem>
      <DropdownMenuItem>Settings</DropdownMenuItem>
      <DropdownMenuItem>Logout</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
```

Keyboard shortcuts:
- `Space/Enter`: Open menu
- `Arrow Up/Down`: Navigate items
- `Esc`: Close menu
- `Tab`: Close and move focus

### Command Palette Navigation

```vue
<script setup lang="ts">
import {
  Command, CommandInput, CommandList,
  CommandGroup, CommandItem
} from "@/components/ui/command"
</script>

<template>
  <Command>
    <CommandInput placeholder="Search..." />
    <CommandList>
      <CommandGroup heading="Suggestions">
        <CommandItem>Calendar</CommandItem>
        <CommandItem>Search</CommandItem>
      </CommandGroup>
    </CommandList>
  </Command>
</template>
```

Features:
- Type to filter
- Arrow keys to navigate
- Enter to select
- Esc to close

## Screen Reader Support

### Semantic HTML

Use proper HTML elements:

```tsx
// Good: Semantic HTML
<button>Click me</button>
<nav><a href="/">Home</a></nav>

// Avoid: Div soup
<div onClick={handler}>Click me</div>
```

### ARIA Labels

**Label interactive elements:**
```vue
<template>
  <Button aria-label="Close dialog">
    <X class="h-4 w-4" />
  </Button>

  <Input aria-label="Email address" type="email" />
</template>
```

**Describe elements:**
```vue
<template>
  <Button aria-describedby="delete-description">
    Delete Account
  </Button>
  <p id="delete-description" class="sr-only">
    This action permanently deletes your account and cannot be undone
  </p>
</template>
```

### Screen Reader Only Text

Use `sr-only` class for screen reader only content:

```vue
<template>
  <Button>
    <Trash class="h-4 w-4" />
    <span class="sr-only">Delete item</span>
  </Button>
</template>
```

### Live Regions

Announce dynamic content:

```vue
<template>
  <div aria-live="polite" aria-atomic="true">
    {{ message }}
  </div>

  <!-- For urgent updates -->
  <div aria-live="assertive">
    {{ error }}
  </div>
</template>
```

Toast component includes live region:
```vue
<script setup lang="ts">
import { useToast } from "@/components/ui/toast/use-toast"

const { toast } = useToast()

function notify() {
  toast({
    title: "Success",
    description: "Profile updated"
  })
  // Announced to screen readers automatically
}
</script>

## Form Accessibility

### Labels and Descriptions

**Always label inputs:**
```vue
<script setup lang="ts">
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
</script>

<template>
  <div>
    <Label for="email">Email</Label>
    <Input id="email" type="email" />
  </div>
</template>
```

**Add descriptions (vee-validate form):**
```vue
<template>
  <FormItem>
    <FormLabel>Username</FormLabel>
    <FormControl>
      <Input v-bind="componentField" />
    </FormControl>
    <FormDescription>
      Your public display name
    </FormDescription>
    <FormMessage /> <!-- Error messages -->
  </FormItem>
</template>
```

### Error Handling

Announce errors to screen readers:

```vue
<template>
  <FormField v-slot="{ componentField, errorMessage }" name="email">
    <FormItem>
      <FormLabel>Email</FormLabel>
      <FormControl>
        <Input
          type="email"
          v-bind="componentField"
          :aria-invalid="!!errorMessage"
          :aria-describedby="errorMessage ? 'email-error' : undefined"
        />
      </FormControl>
      <FormMessage id="email-error" />
    </FormItem>
  </FormField>
</template>
```

### Required Fields

Indicate required fields:

```vue
<template>
  <Label for="name">
    Name <span class="text-destructive">*</span>
    <span class="sr-only">(required)</span>
  </Label>
  <Input id="name" required />
</template>
```

### Fieldset and Legend

Group related fields:

```vue
<template>
  <fieldset>
    <legend class="text-lg font-semibold mb-4">
      Contact Information
    </legend>
    <div class="space-y-4">
      <FormField name="email" />
      <FormField name="phone" />
    </div>
  </fieldset>
</template>
```

## Component-Specific Patterns

### Accordion

```vue
<script setup lang="ts">
import {
  Accordion, AccordionContent,
  AccordionItem, AccordionTrigger
} from "@/components/ui/accordion"
</script>

<template>
  <Accordion type="single" collapsible>
    <AccordionItem value="item-1">
      <AccordionTrigger>
        <!-- Includes aria-expanded, aria-controls automatically via Reka UI -->
        Is it accessible?
      </AccordionTrigger>
      <AccordionContent>
        <!-- Hidden when collapsed, announced when expanded -->
        Yes. Follows WAI-ARIA design pattern.
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</template>
```

### Tabs

```vue
<script setup lang="ts">
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
</script>

<template>
  <Tabs default-value="account">
    <TabsList role="tablist">
      <!-- Arrow keys navigate, Space/Enter activates -->
      <TabsTrigger value="account">Account</TabsTrigger>
      <TabsTrigger value="password">Password</TabsTrigger>
    </TabsList>
    <TabsContent value="account">
      <!-- Hidden unless selected, aria-labelledby links to trigger -->
      Account content
    </TabsContent>
  </Tabs>
</template>
```

### Select

```vue
<script setup lang="ts">
import {
  Select, SelectContent,
  SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
</script>

<template>
  <Select>
    <SelectTrigger aria-label="Choose theme">
      <SelectValue placeholder="Theme" />
    </SelectTrigger>
    <SelectContent>
      <!-- Keyboard navigable, announced to screen readers -->
      <SelectItem value="light">Light</SelectItem>
      <SelectItem value="dark">Dark</SelectItem>
    </SelectContent>
  </Select>
</template>
```

### Checkbox and Radio

```vue
<script setup lang="ts">
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
</script>

<template>
  <div class="flex items-center space-x-2">
    <Checkbox id="terms" aria-describedby="terms-description" />
    <Label for="terms">Accept terms</Label>
  </div>
  <p id="terms-description" class="text-sm text-muted-foreground">
    You agree to our Terms of Service and Privacy Policy
  </p>
</template>
```

### Alert

```vue
<script setup lang="ts">
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
</script>

<template>
  <Alert role="alert">
    <!-- Announced immediately to screen readers -->
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>
      Your session has expired
    </AlertDescription>
  </Alert>
</template>
```

## Color Contrast

Ensure sufficient contrast between text and background.

**WCAG Requirements:**
- **AA**: 4.5:1 for normal text, 3:1 for large text
- **AAA**: 7:1 for normal text, 4.5:1 for large text

**Check defaults:**
```tsx
// Good: High contrast
<p className="text-gray-900 dark:text-gray-100">Text</p>

// Avoid: Low contrast
<p className="text-gray-400 dark:text-gray-600">Hard to read</p>
```

**Muted text:**
```vue
<template>
  <!-- Use semantic muted foreground -->
  <p class="text-muted-foreground">
    Secondary text with accessible contrast
  </p>
</template>
```

## Focus Indicators

Always provide visible focus indicators:

**Default focus ring:**
```vue
<template>
  <Button class="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
    Button
  </Button>
</template>
```

**Custom focus styles:**
```vue
<template>
  <a href="#" class="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:underline">
    Link
  </a>
</template>
```

**Don't remove focus styles:**
```vue
<template>
  <!-- Avoid -->
  <button class="focus:outline-none">Bad</button>

  <!-- Use focus-visible instead -->
  <button class="focus-visible:ring-2">Good</button>
</template>
```

## Motion and Animation

Respect reduced motion preference:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

In components:
```tsx
<div className="transition-all motion-reduce:transition-none">
  Respects user preference
</div>
```

## Testing Checklist

- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible
- [ ] Screen reader announces all content correctly
- [ ] Form errors announced and associated
- [ ] Color contrast meets WCAG AA
- [ ] Semantic HTML used
- [ ] ARIA labels provided for icon-only buttons
- [ ] Modal/dialog focus trap works
- [ ] Dropdown/select keyboard navigable
- [ ] Live regions announce updates
- [ ] Respects reduced motion preference
- [ ] Works with browser zoom up to 200%
- [ ] Tab order logical
- [ ] Skip links provided for navigation

## Tools

**Testing tools:**
- Lighthouse accessibility audit
- axe DevTools browser extension
- NVDA/JAWS screen readers
- Keyboard-only navigation testing
- Color contrast checkers (Contrast Ratio, WebAIM)

**Automated testing:**
```bash
pnpm add -D @axe-core/vue
```

```ts
// main.ts (development only)
if (import.meta.env.DEV) {
  import('@axe-core/vue').then(({ default: axe }) => {
    axe(app, 1000)
  })
}
```
