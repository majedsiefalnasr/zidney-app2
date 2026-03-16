---
name: tailwind-design-system
description: Design token system and Tailwind CSS v4 architecture for the Zidney platform. Use when defining tokens, theming, layout primitives, animation tokens, or design-system rules inside packages/ui-system.
---

# Zidney Tailwind Design System

This skill governs the **design system layer** of the Zidney platform.

It defines:

• design tokens  
• Tailwind CSS v4 configuration  
• theming rules  
• layout primitives  
• animation tokens  
• accessibility styling patterns  

This skill applies only to:

```
packages/ui-system
```

Applications must **never define their own design tokens**.

---

# Design System Architecture

Zidney uses a **three-layer design system**.

```
Brand Tokens
      ↓
Semantic Tokens
      ↓
Component Tokens
```

Example:

```
oklch(45% 0.2 260)
        ↓
--color-primary
        ↓
bg-primary
```

Applications must **only consume semantic tokens**.

---

# Technology Stack

The Zidney design system uses:

```
Tailwind CSS v4
CSS-first configuration
OKLCH color system
CSS variables
```

Tailwind is configured using:

```
@theme
@custom-variant
@utility
```

No traditional `tailwind.config.ts` should be used.

---

# Tailwind Entry File

The design system must define Tailwind configuration inside:

```
packages/ui-system/src/styles/app.css
```

Example base configuration:

```
@import "tailwindcss";
```

---

# Theme Tokens

Tokens must be declared inside a `@theme` block.

Example:

```
@theme {
  --color-background: oklch(100% 0 0);
  --color-foreground: oklch(14.5% 0.025 264);

  --color-primary: oklch(14.5% 0.025 264);
  --color-primary-foreground: oklch(98% 0.01 264);

  --color-muted: oklch(96% 0.01 264);
  --color-muted-foreground: oklch(46% 0.02 264);

  --color-border: oklch(91% 0.01 264);
  --color-ring: oklch(14.5% 0.025 264);
}
```

---

# Radius Tokens

Border radius must be standardized.

```
--radius-sm
--radius-md
--radius-lg
--radius-xl
```

Example:

```
--radius-md: 0.375rem;
--radius-lg: 0.5rem;
```

---

# Animation Tokens

Animations must be defined using CSS keyframes inside `@theme`.

Example:

```
@theme {
  --animate-fade-in: fade-in 0.2s ease-out;

  @keyframes fade-in {
    from { opacity: 0 }
    to { opacity: 1 }
  }
}
```

Components must reference tokens using:

```
animate-fade-in
```

---

# Dark Mode

Dark mode must be implemented using Tailwind v4 variants.

Example:

```
@custom-variant dark (&:where(.dark, .dark *));
```

Dark tokens override base tokens.

Example:

```
.dark {
  --color-background: oklch(14.5% 0.025 264);
  --color-foreground: oklch(98% 0.01 264);
}
```

Apps must **not implement their own theme toggles**.

---

# Layout Primitives

Layout helpers should be defined using reusable utility patterns.

Examples:

```
Container
Grid
Stack
```

Example container pattern:

```
mx-auto w-full px-4 sm:px-6 lg:px-8
max-w-screen-xl
```

---

# Spacing System

Spacing must follow Tailwind scale.

Preferred utilities:

```
gap-4
p-4
px-6
py-8
space-y-4
```

Avoid arbitrary values like:

```
p-[17px]
```

---

# Color Usage Rules

Allowed:

```
bg-primary
text-muted-foreground
border-border
```

Forbidden:

```
bg-blue-500
bg-red-600
text-green-700
```

Apps must **never hardcode colors**.

---

# Typography

Typography should use Tailwind utilities.

Examples:

```
text-sm
text-base
text-lg
font-medium
leading-tight
tracking-tight
```

Avoid custom font-size declarations.

---

# Custom Utilities

Custom utilities must be defined using Tailwind v4 `@utility`.

Example:

```
@utility text-gradient {
  @apply bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent;
}
```

---

# Container Queries

If needed, define container tokens:

```
--container-xs
--container-sm
--container-md
--container-lg
```

These should support responsive layout primitives.

---

# Accessibility Styling

Design tokens must support accessibility.

Required:

• visible focus rings  
• accessible color contrast  
• focus-visible states  

Example focus ring:

```
focus-visible:ring-2
focus-visible:ring-ring
focus-visible:ring-offset-2
```

---

# Animation Best Practices

Use lightweight animations.

Avoid:

```
large transform chains
long-duration animations
layout thrashing
```

Prefer:

```
opacity
transform
```

---

# Prohibited Patterns

The following are not allowed:

```
apps/* defining tokens
apps/* modifying Tailwind config
apps/* adding Tailwind plugins
```

Design system rules belong only to:

```
packages/ui-system
```

---

# When To Use This Skill

Use this skill when:

• defining design tokens  
• modifying Tailwind configuration  
• implementing animations  
• building layout primitives  
• defining theme variables  

Do not use this skill for:

• UI component development  
• frontend feature development  

Those belong to:

```
shadcn-vue-ui-system
zidney-frontend-engineering
```

---

# Related Skills

```
shadcn-vue-ui-system
zidney-frontend-engineering
```

This skill governs **the design token and styling layer** of Zidney.
