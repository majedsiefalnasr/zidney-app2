---
name: zidney-frontend-engineering
description: Frontend engineering rules and patterns for the Zidney platform. Use when implementing Vue 3 + TypeScript features inside apps/*, building UI using the shared ui-system package, integrating API clients, implementing state management, routing, forms, and performance patterns within the Zidney monorepo.
---

# Zidney Frontend Engineering

This skill defines the **official frontend development rules for Zidney applications**.

It applies to all frontend apps inside:

```
apps/mmc
apps/backoffice
apps/frontoffice
```

Zidney frontend development follows a **strict monorepo architecture** with centralized UI, types, validation, and API access.
Frontend code must **never bypass shared platform packages**.

---

# Zidney Frontend Stack

## Framework

```
Vue 3
TypeScript
Vite
```

## UI Layer

```
shadcn-vue
Tailwind CSS v4
packages/ui-system
```

## State Management

```
Pinia
```

## Routing

```
vue-router
```

## Validation

```
packages/validation
Zod schemas
```

## API Access

```
packages/api-client
```

## Shared Contracts

```
packages/types
```

---

# Monorepo Architecture Rules

## NEVER Import Across App Boundaries

Apps must **never import from other apps**.

Forbidden:

```
apps/mmc → apps/backoffice
apps/backoffice → apps/frontoffice
```

Apps may only import from:

```
packages/*
```

---

## UI Components Must Come From `ui-system`

All shared UI components belong in:

```
packages/ui-system
```

Apps must **not create reusable UI components**.

Allowed:

```
import { Button } from "@zidney/ui-system"
```

Forbidden:

```
apps/mmc/components/Button.vue
```

Reusable components must be added to the UI system.

---

## Never Install UI Libraries In Apps

Apps must not install UI frameworks.

Forbidden:

```
npm install shadcn-vue
npm install radix
npm install tailwind plugins
```

UI dependencies belong only in:

```
packages/ui-system
```

---

# Recommended App Structure

Each frontend app should follow this structure:

```
apps/<app-name>

src/
  pages/
  components/
  features/
  stores/
  router/
  composables/
  services/
  utils/
```

## Pages

```
src/pages
```

Top-level route views.
Pages should remain thin and delegate logic to features.

---

## Features

```
src/features/<feature>
```

Feature modules contain:

```
components/
store.ts
service.ts
types.ts
```

This keeps logic modular and scalable.

---

## Components

```
src/components
```

Components here must be **app-specific only**.

Reusable components belong in:

```
packages/ui-system
```

---

# API Integration

All API requests must go through:

```
packages/api-client
```

Example:

```ts
import { apiClient } from "@zidney/api-client"
const users = await apiClient.users.list()
```

Apps must **never use raw fetch/axios**.

Forbidden:

```
fetch("/api/users")
axios.get("/api/users")
```

---

# Validation Rules

All validation schemas must come from:

```
packages/validation
```

Example:

```ts
import { createUserSchema } from "@zidney/validation"
```

Forms must reuse shared schemas.

---

# State Management (Pinia)

Pinia stores should live in:

```
src/stores
```

Example:

```ts
import { defineStore } from "pinia"
export const useUserStore = defineStore("users", {
  state: () => ({
    users: []
  })
})
```

Rules:

• One store per domain  
• Avoid global mega-stores  
• Keep stores domain-focused  

---

# Routing

Routing lives in:

```
src/router
```

Example:

```ts
import { createRouter, createWebHistory } from "vue-router"
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: () => import("../pages/Dashboard.vue")
    }
  ]
})
```

Rules:

• Use lazy-loaded routes  
• Avoid importing page components directly  

---

# Composables

Reusable logic belongs in:

```
src/composables
```

Example:

```ts
export function useDebounce(value, delay = 300) {
  const debounced = ref(value)
  watch(value, () => {
    setTimeout(() => {
      debounced.value = value.value
    }, delay)
  })

  return debounced
}
```

---

# Forms

Forms should use:

```
AutoForm (shadcn-vue)
Zod validation
packages/validation schemas
```

Example:

```vue
<script setup lang="ts">
import { AutoForm } from "@zidney/ui-system"
import { createUserSchema } from "@zidney/validation"
function submit(values) {
  console.log(values)
}
</script>

<template>
  <AutoForm
    :schema="createUserSchema"
    @submit="submit"
  />
</template>
```

---

# Performance Rules

## Prefer Server Data Fetching

Avoid large client-side data orchestration.
Use paginated APIs.

---

## Lazy Load Large Components

Use dynamic imports:

```
const Dashboard = () => import("../pages/Dashboard.vue")
```

---

## Avoid Large Global Stores

Split stores by feature.

---

# Accessibility Rules

All UI must follow accessibility best practices.

Required:

• semantic HTML  
• keyboard navigation  
• focus states  
• ARIA labels where needed  

shadcn-vue components already provide strong defaults.

---

# Styling Rules

All styling must use Tailwind utilities.

Allowed:

```
bg-primary
text-muted-foreground
flex
grid
gap-4
```

Forbidden:

```
inline style attributes
custom CSS unless necessary
hardcoded colors
```

Never use:

```
bg-blue-500
bg-red-500
```

Use design tokens instead.

---

# Dark Mode

Dark mode is handled by the UI system.
Apps must not implement independent theme systems.

---

# Error Handling

Frontend errors should be handled via:

```
feature-level error boundaries
API error normalization
```

Avoid silent failures.

---

# Testing Expectations

Frontend tests should use:

```
Vitest
Vue Test Utils
```

Tests should focus on:

• component behavior  
• user interactions  
• feature logic  

---

# When To Use This Skill

Use this skill when:

• building frontend features  
• creating Vue components  
• integrating APIs  
• implementing forms  
• designing feature modules  
• writing Pinia stores  
• structuring frontend apps  

Do not use this skill for:

• UI system development  
• design token management  
• architecture governance  

Those belong to other Zidney skills.

---

This skill focuses on **application-level frontend engineering**.
