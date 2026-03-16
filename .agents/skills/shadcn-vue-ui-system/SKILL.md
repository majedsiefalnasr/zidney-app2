---
name: shadcn-vue-ui-system
description: Governance and maintenance rules for the Zidney UI system built with shadcn-vue, Reka UI, and Tailwind CSS v4. Use when creating or modifying shared UI components inside packages/ui-system.
---

# Zidney UI System (shadcn-vue)

This skill governs the **shared UI component system for the Zidney platform**.

It applies **only** to the UI library located at:

packages/ui-system

This package provides **all reusable UI primitives, layouts, and visual components** used across Zidney applications.

Applications must **never implement their own shared UI primitives**.

---

# Purpose of the UI System

The UI system centralizes:

• UI primitives  
• component accessibility  
• design tokens  
• layout patterns  
• theming  
• dark mode  
• reusable UI behaviors  

This ensures **visual consistency and maintainability** across the platform.

---

# Technology Stack

The Zidney UI system is built using:

Vue 3  
TypeScript  
shadcn-vue  
Reka UI primitives  
Tailwind CSS v4  

Supporting libraries:

class-variance-authority  
tailwind-merge  
clsx  

---

# UI System Directory Structure

All UI components must live inside:

packages/ui-system/src

Recommended structure:

packages/ui-system  
src/  
  components/  
    ui/  
    layout/  
    feedback/  
  composables/  
  providers/  
  utils/  
  styles/  

---

# Component Categories

## UI Primitives

Location:

src/components/ui

Examples:

Button  
Input  
Dialog  
Dropdown  
Popover  
Checkbox  
Tabs  
Select  
Tooltip  

These are **low-level building blocks**.

---

## Layout Components

Location:

src/components/layout

Examples:

PageLayout  
Sidebar  
Header  
ContentContainer  
Grid  
Stack  

Used to structure application screens.

---

## Feedback Components

Location:

src/components/feedback

Examples:

Alert  
Toast  
EmptyState  
ErrorState  
Skeleton  
LoadingIndicator  

Used for communicating system state.

---

# Component Creation Workflow

New UI components must be created inside:

packages/ui-system

Example:

cd packages/ui-system  
bunx shadcn-vue@latest add dialog

Rules:

• Components must live in `src/components/ui`  
• Imports must use the internal alias `@/`  
• Components must be exported through the package index  

---

# Component Export Rules

All components must be exported via:

packages/ui-system/src/index.ts

Example:

```ts
export * from "./components/ui/button"
export * from "./components/ui/input"
export * from "./components/ui/dialog"
