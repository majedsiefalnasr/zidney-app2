---
name: i18n-governance
description: Internationalization and localization governance for Zidney — Arabic/English, RTL layout, translation keys, and locale file management
metadata:
  category: localization
  scope: frontend
  capabilities:
    - translation key management
    - RTL layout rules
    - locale file structure
    - pluralization patterns
    - date/time localization
  priority: high
---

# i18n Governance Skill

Zidney is an educational SaaS platform serving Arabic and English users. This skill defines governance for internationalization (i18n) and localization (l10n).

---

## Supported Locales

| Locale | Language | Direction | Priority |
|--------|----------|-----------|----------|
| `ar` | Arabic | RTL | Primary |
| `en` | English | LTR | Secondary |

Arabic is the primary locale. All UI must work correctly in RTL before LTR is tested.

---

## Locale File Structure

```
packages/ui-system/src/locales/
  ├── ar/
  │   ├── common.json
  │   ├── exam.json
  │   ├── auth.json
  │   └── dashboard.json
  └── en/
      ├── common.json
      ├── exam.json
      ├── auth.json
      └── dashboard.json
```

Rules:
- One JSON file per domain/feature
- Arabic and English files must have identical key sets
- Keys are dot-separated: `exam.title`, `auth.login_button`
- Never hardcode user-visible strings in components

---

## Translation Key Convention

Format: `<domain>.<context>.<element>`

```json
{
  "exam": {
    "list": {
      "title": "الاختبارات",
      "empty_state": "لا توجد اختبارات",
      "create_button": "إنشاء اختبار"
    },
    "detail": {
      "duration_label": "مدة الاختبار",
      "questions_count": "عدد الأسئلة"
    }
  }
}
```

Forbidden:
- Abbreviated keys: `ex.lst.ttl` ❌
- Numeric keys: `exam.1.title` ❌
- Concatenating translated strings to build sentences ❌
- Using translation keys for non-user-visible strings ❌

---

## RTL Layout Rules

### Tailwind CSS v4 RTL Support

Use logical properties instead of physical:

```html
<!-- ❌ Wrong: physical direction -->
<div class="ml-4 pl-2 text-left">

<!-- ✅ Correct: logical direction -->
<div class="ms-4 ps-2 text-start">
```

| Physical (Don't Use) | Logical (Use Instead) |
|----------------------|----------------------|
| `ml-*`, `mr-*` | `ms-*`, `me-*` |
| `pl-*`, `pr-*` | `ps-*`, `pe-*` |
| `text-left`, `text-right` | `text-start`, `text-end` |
| `left-*`, `right-*` | `start-*`, `end-*` |
| `border-l-*`, `border-r-*` | `border-s-*`, `border-e-*` |

### Component RTL Rules

- Icons with directional meaning (arrows, chevrons) must flip in RTL
- Form labels must appear on the correct side for the locale
- Table columns should maintain logical order
- Progress bars must fill from the correct direction

---

## Pluralization

Arabic has 6 plural forms. Use ICU MessageFormat:

```json
{
  "questions_count": "{count, plural, =0 {لا توجد أسئلة} one {سؤال واحد} two {سؤالان} few {{count} أسئلة} many {{count} سؤالاً} other {{count} سؤال}}"
}
```

English has 2 plural forms:

```json
{
  "questions_count": "{count, plural, =0 {No questions} one {1 question} other {{count} questions}}"
}
```

---

## Date/Time Localization

- Use `Intl.DateTimeFormat` with the active locale
- Never format dates manually with string concatenation
- Exam timestamps must show in the user's timezone
- Server stores all times in UTC

```typescript
const formatted = new Intl.DateTimeFormat(locale, {
  dateStyle: 'long',
  timeStyle: 'short',
}).format(date);
```

---

## Number Formatting

Arabic uses Eastern Arabic numerals in some contexts:

```typescript
const formatted = new Intl.NumberFormat(locale).format(number);
```

---

## Forbidden Practices

- Hardcoded Arabic or English strings in components
- Using `dir="rtl"` inline — set at the `<html>` level
- Assuming left-to-right layout in CSS
- String concatenation for translated sentences
- Missing translations (all keys must exist in all locales)

---

## Verdict Protocol

```
VERDICT: PASS   — all strings use translation keys, RTL-safe layout
VERDICT: BLOCKED — hardcoded strings or physical CSS properties in RTL context
```
