# STAGE_UI_08_NOTIFICATION_AND_FEEDBACK

## Stage Type

UI Foundation — Global Notifications & User Feedback Layer

---

## Stage Status

Status: DRAFT

---

## Purpose

Define a unified notification and feedback architecture across:

- MMC
- Backoffice
- Frontoffice

This stage standardizes:

- Toast notifications
- Inline error rendering
- Global error banners
- Success confirmations
- Loading indicators
- Async action feedback
- Form validation display rules

This layer ensures consistent UX behavior for all API-driven interactions.

This stage does NOT define business messages. It defines how messages are displayed and handled.

---

## Constitutional Constraints

Notification system must:

- Never expose sensitive data (tokens, stack traces, raw SQL errors)
- Never override backend authority
- Never swallow critical errors silently
- Never log secrets to console
- Never leak cross-tenant data

UI may display:

- Sanitized message
- Standardized error code
- Correlation ID (optional for support)

Backend remains the source of truth.

---

## Feedback Layer Architecture

Architecture flow:

```
API → ApiClient → Store → ErrorNormalizer → Notification Store → UI Components
```

No component may display raw API response directly.

All errors must pass through:

```
core/errors/
```

---

## Notification Store

Location:

```
core/state/notification.store.ts
```

Responsibilities:

- Queue toast notifications
- Handle success/info/warning/error types
- Auto-dismiss timers
- Manual dismissal
- Global error modal (if needed)

State shape example:

```
{
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  code?: string
  persistent?: boolean
}
```

Store must:

- Prevent duplicate identical toasts within short window
- Cap queue length (e.g., max 5 visible)
- Remove expired entries automatically

---

## Toast Notifications

Use UI system primitives from:

```
@zidney/ui-system
```

Rules:

- Success → green accent
- Error → red accent
- Warning → yellow accent
- Info → neutral accent

Duration:

- Success: 3–5 seconds
- Info: 4–6 seconds
- Warning: 6–8 seconds
- Error: persistent until dismissed (default)

No blocking modals unless explicitly required.

---

## Error Handling Strategy

Errors categorized:

1. Validation Errors (400)

- Display inline at form field
- Highlight invalid input
- Do not show global toast unless systemic

2. Authorization Errors (401/403)

- Redirect to login or show permission banner
- No repeated toasts on every request

3. Business Rule Errors (409/422)

- Show descriptive toast
- Allow user retry

4. System Errors (500)

- Show generic error toast
- Optionally display correlation ID
- Never display stack trace

5. Network Errors

- Show offline banner
- Retry mechanism available

---

## Form Feedback Rules

Forms must:

- Use field-level validation via Zod
- Display validation errors under fields
- Disable submit during loading
- Prevent duplicate submissions
- Reset loading state on completion

Never:

- Clear user input on error
- Hide backend validation messages

---

## Async Action Feedback

All async store actions must:

- Set loading state
- Trigger success notification (if appropriate)
- Trigger error notification (normalized)
- Reset loading on completion

Pattern:

```
try {
  await apiCall()
  notify.success(...)
} catch (error) {
  notify.error(normalizedError.message)
}
```

No silent failures allowed.

---

## Multi-App Considerations

MMC:

- Platform-level notifications
- No workspace-specific error exposure

Backoffice:

- Workspace-aware context
- Include workspace_slug in support message if needed

Frontoffice:

- Attempt-related error messages must not interrupt exam flow unnecessarily
- Non-critical toasts minimized during active exam

---

## Offline & Reconnect UX

If network lost:

- Show top banner: "Connection lost"
- Auto-hide when connection restored
- Queue retryable actions if applicable

No infinite retry loops.

---

## Security & Logging

UI logging rules:

- Never log tokens
- Never log raw API responses
- Strip sensitive fields before console.debug
- In production, console logs minimized

Error reporting (future extension):

- May integrate with Sentry or equivalent
- Must redact PII

---

## Testability Requirements

Notification system must support:

- Store-level unit tests
- Simulated API error injection
- Toast queue overflow test
- Auto-dismiss timer test
- Validation error mapping test
- Offline simulation test

Must work without backend availability.

---

## Explicit Non-Goals

This stage does NOT:

- Define business error codes
- Define backend error schema
- Implement real-time websocket notifications
- Implement email/SMS notifications
- Implement notification center history
- Define push notifications

Only UI notification and feedback behavior.

---

## Completion Criteria

Stage complete when:

- Notification store implemented
- Error normalization layer integrated
- Toast component standardized
- Form validation pattern consistent
- Loading states consistent
- Duplicate prevention active
- Offline banner implemented
- No raw API error rendering
- CI passes lint + TypeScript
- No TODO placeholders in feedback layer

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
