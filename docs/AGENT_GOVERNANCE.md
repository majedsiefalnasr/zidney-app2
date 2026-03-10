# 🏛 Zidney Agent Governance v1.0

**Status:** Active  
**Scope:** All AI agents operating within Zidney Hard Mode  
**Authority Level:** Binding

---

## 1. Purpose

Zidney Agent Governance defines the mandatory behavioral rules for all AI agents operating within
the Zidney engineering system.

This document governs:

- Agent execution behavior
- Authority boundaries
- Workflow compliance
- Determinism requirements
- Drift prevention

This document does NOT redefine architecture.  
Architecture authority belongs to the Zidney Constitution.

---

## 2. Authority Hierarchy (Non-Negotiable)

All agents MUST obey the following authority order:

1. Zidney Constitution v1.2.0 → Architectural authority
2. Approved ADRs → Structural decision authority
3. Zidney Orchestrator → Workflow authority
4. Zidney Agent Governance v1.0 → Behavioral authority

If a conflict exists, higher authority prevails.

Agents MUST NOT override higher authority under any circumstances.

---

## 3. Core Behavioral Rules

## Rule 1 — Orchestrator Supremacy

The Zidney Orchestrator is the sole workflow authority.

Agents MUST NOT:

- Update `.workflow-state.json`
- Modify Stage Status blocks
- Declare PRODUCTION READY
- Skip workflow steps
- Advance lifecycle gates
- Create or switch branches
- Perform git operations
- Close or reopen stages

Lifecycle control belongs exclusively to the Orchestrator.

---

### Rule 2 — Deterministic Output

Agents MUST:

- Produce structured outputs
- Avoid conversational or speculative reasoning
- Avoid architectural brainstorming during execution
- Avoid ambiguous conclusions

Enforcement agents MUST use binary semantics:

```
VERDICT: PASS
VERDICT: BLOCKED
```

Agents MUST NOT use:

- “Mostly fine”
- “Minor issue but acceptable”
- “Recommendation only” for blocking conditions

Binary enforcement is mandatory.

---

### Rule 3 — Scope Isolation

Agents MUST operate strictly within the active stage scope.

Agents MUST NOT:

- Modify unrelated modules
- Expand task scope
- Perform cross-domain cleanup
- Refactor outside assigned boundaries
- Introduce unrelated improvements

Horizontal drift is prohibited.

---

### Rule 4 — Constitution Binding

All agents MUST enforce Zidney architectural invariants, including:

- Database-per-tenant isolation
- Transactional integrity
- Idempotency for critical flows
- Server-authoritative time
- Semantic versioning
- Version compatibility rules
- Snapshot immutability (where applicable)

These rules apply even if not explicitly mentioned in a stage.

Violation of constitutional invariants requires immediate BLOCK.

---

### Rule 5 — No Silent Redesign

If an agent detects structural or architectural flaws:

- The agent MUST request an ADR.
- The agent MUST stop further modification.
- The agent MUST NOT redesign in-place.

Agents may detect architecture issues.  
Agents may NOT implement architectural change without ADR approval.

---

### Rule 6 — Analyze Is the Final Gate

Only the Analyze phase may authorize implementation.

If:

```
drift_passed = false
```

Implementation is strictly forbidden.

No agent may override this condition.

---

### Rule 7 — Implementation Discipline

Execution agents MUST:

- Implement tasks exactly as planned
- Avoid optimization beyond scope
- Avoid refactoring beyond scope
- Avoid architectural modification
- Halt immediately if constitutional conflict is detected

All architectural thinking MUST occur before implementation.

---

## 4. Drift Protection

A governance violation occurs if an agent:

- Expands scope without authorization
- Modifies lifecycle state
- Bypasses workflow gates
- Redesigns architecture without ADR
- Produces ambiguous enforcement output
- Weakens tenant isolation
- Weakens idempotency guarantees
- Weakens RBAC enforcement

Governance violations require immediate halt and correction.

---

## 5. Enforcement Model

All agents operating within Zidney MUST implicitly comply with:

- Workflow Authority: Zidney Orchestrator
- Architectural Authority: Zidney Constitution
- Behavioral Authority: Agent Governance v1.0
- Verdict Semantics: PASS | BLOCKED
- Lifecycle Mutation: Forbidden

Agents are deterministic executors within a governed system.

---

## 6. Scalability Clause

Any future agent introduced into Zidney MUST:

- Declare compliance with Agent Governance v1.0
- Respect Orchestrator supremacy
- Respect Constitution binding
- Avoid independent lifecycle logic
- Avoid autonomous workflow control

No agent may operate outside this governance model.

---

## 7. UI System Enforcement (Shadcn-Vue + Tailwind v4)

All agents generating UI components, layouts, or styling MUST enforce the following rules without
exception.

### Rule 7.1 — Shadcn-Vue Base Component Requirement

**Mandatory:** All UI components MUST use shadcn-vue as the base layer.

Agents MUST NOT:

- Create custom components from scratch
- Use generic HTML elements without wrapping in shadcn-vue equivalents
- Design custom component systems when shadcn-vue alternatives exist
- Mix shadcn-vue with competing component libraries

**Enforcement:**

- ✅ Button: Use `<Button />` from shadcn-vue
- ✅ Form Input: Use `<Input />` from shadcn-vue
- ✅ Modal: Use `<Dialog />` from shadcn-vue
- ✅ Select: Use `<Select />` from shadcn-vue
- ❌ Custom button with inline styles
- ❌ Bare `<input>` elements
- ❌ Custom modal implementation

**Verdict Logic:** If any custom component exists without a shadcn-vue base:

```
VERDICT: BLOCKED — Custom component detected without shadcn-vue base
Required Action: Refactor to extend shadcn-vue component
```

---

### Rule 7.2 — Tailwind v4 Styling Mandate

**Mandatory:** All styling MUST use Tailwind v4 CSS utility classes only.

Agents MUST NOT:

- Write custom `<style>` blocks with manual CSS
- Use inline style attributes for layout/spacing/colors
- Create custom CSS classes for design system properties
- Use CSS-in-JS or PostCSS custom properties for component styling

**Enforcement:**

**✅ CORRECT — Tailwind classes only:**

```vue
<div class="flex items-center justify-between gap-4 p-6">
  <Button variant="primary" class="w-full">Submit</Button>
</div>
```

**❌ INCORRECT — Custom styles:**

```vue
<div style="display: flex; gap: 1rem; padding: 1.5rem;">
  <button class="custom-button">Submit</button>
</div>

<style>
.custom-button {
  background: #2563eb;
  padding: 0.5rem 1rem;
}
</style>
```

**Allowed Exception:** `@apply` directive for shared utilities only:

```vue
<style scoped>
.form-wrapper {
  @apply flex flex-col gap-4 p-6;
}
</style>
```

**Usage:** Must be in a scoped style block, not inline. Must apply only Tailwind utilities.

---

### Rule 7.3 — Shadcn-Vue Default Theme Preservation

**Mandatory:** All components MUST use shadcn-vue's default theme without customization.

Agents MUST NOT:

- Override shadcn-vue component props (except `variant`, `size`, or data props)
- Modify component internal styling
- Create wrapper components that hide shadcn-vue's design language
- Use custom color values outside Tailwind v4 palette

**Enforcement:**

**✅ CORRECT:**

```vue
<Button variant="outline" size="lg">Click me</Button>
<Input placeholder="Enter value" />
<Dialog open="{isOpen}">
  <DialogContent>
    <p>Modal content</p>
  </DialogContent>
</Dialog>
```

**❌ INCORRECT:**

```vue
<!-- Custom override breaking design system -->
<Button :style="{ backgroundColor: '#custom-color', padding: '10px' }">
  Click me
</Button>

<!-- Hiding component design -->
<div class="my-custom-wrapper">
  <Input @input="handleInput" />
</div>
```

---

### Rule 7.4 — Tailwind v4 Configuration Requirement

**Mandatory:** All projects using UI components MUST configure Tailwind v4 correctly.

Required Configuration:

1. **tailwind.config.ts:**
   - `content` MUST include `./node_modules/@zidney/shadcn-vue/**/*.{js,mjs,ts}`
   - `theme.extend` MUST NOT override shadcn-vue base colors
   - `corePlugins.preflight` MUST be `true` for shadcn-vue base styles

2. **postcss.config.js:**
   - MUST include `tailwindcss/nesting` plugin
   - MUST include `tailwindcss` plugin
   - MUST include `autoprefixer` plugin

3. **CSS Entry Point:**
   - MUST import `/index.css` from shadcn-vue
   - MUST include `@tailwind base;` before custom styles
   - MUST include `@tailwind components;`
   - MUST include `@tailwind utilities;`

**Enforcement:**

Agents MUST validate configuration before component generation:

```
If tailwind.config.ts missing shadcn-vue content -> BLOCKED
If postcss.config.js missing plugins -> BLOCKED
If CSS entry point missing directives -> BLOCKED
```

---

### Rule 7.5 — Component File Structure (shadcn-vue Pattern)

**Mandatory:** All components MUST follow shadcn-vue file structure pattern.

Required Structure:

```
components/
├── ComponentName/
│   ├── index.ts          (export)
│   └── ComponentName.vue (implementation)
```

**Implementation Pattern:**

**ComponentName.vue:**

```vue
<template>
  <div class="component-wrapper">
    <!-- Use shadcn-vue components as base -->
    <Button @click="handleClick">{{ label }}</Button>
  </div>
</template>

<script setup lang="ts">
import { defineProps } from "vue";
import { Button } from "@zidney/shadcn-vue";

interface Props {
  label: string;
}

defineProps<Props>();

const handleClick = () => {
  // Event handling
};
</script>

<style scoped>
/* Tailwind classes only via @apply directive -->
.component-wrapper {
  @apply flex gap-4 p-4;
}
</style>
```

**index.ts:**

```typescript
export { default as ComponentName } from "./ComponentName.vue";
export type { Props as ComponentNameProps } from "./ComponentName.vue";
```

---

### Rule 7.6 — Type Safety for shadcn-vue Components

**Mandatory:** All component props and events MUST be fully typed.

Agents MUST NOT:

- Use `any` types
- Omit prop type definitions
- Create ambiguous event handlers
- Use implicit `unknown` types

**Enforcement:**

**✅ CORRECT:**

```typescript
interface Props {
  variant: "primary" | "secondary" | "outline";
  size: "sm" | "md" | "lg";
  disabled?: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  click: [event: MouseEvent];
  submit: [value: string];
}>();
```

**❌ INCORRECT:**

```typescript
const props = defineProps({
  variant: String, // ❌ No specific type
  size: Function, // ❌ Wrong type
  data: Object, // ❌ Implicit any
});

const emit = defineEmits(["click", "submit"]); // ❌ No types
```

---

### Rule 7.7 — CSS Scoping Enforcement

**Mandatory:** All component styles MUST be scoped to prevent global pollution.

Agents MUST NOT:

- Use unscoped `<style>` blocks
- Create global CSS files for component styling
- Add styles outside scoped boundaries
- Use global `class="my-custom-class"` without shadcn-vue base

**Enforcement:**

**✅ CORRECT:**

```vue
<style scoped>
.wrapper {
  @apply flex gap-4;
}
</style>
```

**❌ INCORRECT:**

```vue
<style>
.wrapper {
  display: flex;
  gap: 1rem;
}
</style>

<!-- Global CSS file -->
/* global.css */ .wrapper { display: flex; }
```

**Verdict Logic:** If unscoped styles detected:

```
VERDICT: BLOCKED — CSS pollution detected
Required Action: Add 'scoped' attribute to <style> tag
```

---

### Rule 7.8 — No Custom Styling Outside Tailwind

**Mandatory:** Zero custom CSS properties or manual style calculations outside Tailwind.

Agents MUST NOT:

- Calculate spacing: `margin: ${16 + 8}px;` ❌ Use `m-6` instead ✅
- Hardcode colors: `background: #2563eb;` ❌ Use `bg-blue-600` instead ✅
- Calculate font sizes: `font-size: ${14 + 2}px;` ❌ Use `text-base` instead ✅
- Override Tailwind defaults with CSS variables

**Enforcement:**

All component styling MUST come from:

1. shadcn-vue component base
2. Tailwind v4 utility classes
3. `@apply` directive within scoped styles
4. Workspace-overrideable CSS variables ONLY (brand colors)

**Verdict Logic:** If manual styling detected:

```
VERDICT: BLOCKED — Custom CSS detected outside Tailwind
Required Action: Replace with Tailwind utilities
```

---

### Rule 7.9 — Audit Gate for UI Components

Before generating or modifying ANY UI component, agents MUST execute this gate:

**Gate Checklist:**

```
☐ Component extends shadcn-vue base?
☐ All styling uses Tailwind v4 classes?
☐ No custom <style> blocks with manual CSS?
☐ All styles scoped to component?
☐ All props fully typed (no any)?
☐ All events fully typed?
☐ No CSS variables outside brand tokens?
☐ File structure follows shadcn-vue pattern?
☐ No global stylesheet imports?
☐ ESLint vue-scoped-style rule passes?

If ANY item is ❌ -> STOP and remediate before proceeding.
```

**Enforcement:**

```
VERDICT: BLOCKED
Reason: UI component fails gate check [item number]
Action Required: [remediation steps]
```

---

### Rule 7.10 — UI System Guard Escalation

If an agent detects violations in existing code:

1. **STOP implementation immediately**
2. **Document all violations** with file paths and line numbers
3. **Refuse to generate new code** that depends on violated components
4. **Escalate to Orchestrator** for remediation
5. **Mark as BLOCKED** until remediation complete

**Escalation Template:**

```
VERDICT: BLOCKED — UI System Violations Detected

Violations Found:
- [File] Line [N]: [violation type] — [fix required]
- [File] Line [N]: [violation type] — [fix required]

Remediation Required Before Proceeding:
1. [specific action]
2. [specific action]

Escalation: Requires manual remediation + re-audit
```

---

## 8. Effective Date

This governance model is effective immediately upon adoption and applies to all current and future
Zidney AI agents.

---

**End of Document**
