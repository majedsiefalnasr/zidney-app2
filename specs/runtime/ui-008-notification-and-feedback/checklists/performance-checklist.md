# Performance Checklist — STAGE_UI_08_NOTIFICATION_AND_FEEDBACK

**Stage**: STAGE_UI_08_NOTIFICATION_AND_FEEDBACK  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Apps**: MMC, Backoffice, Frontoffice  
**Date**: 2026-04-07

---

## Notification Store

- [ ] `push()` is synchronous — no `await`, no microtask scheduling, no side effects inside the hot path
- [ ] Deduplication check is O(n) for n ≤ 20 queue entries — no nested loops or regex over queue contents
- [ ] The private `lastPushed: Map<string, number>` is bounded: cleared in `$reset()` and `clearAll()` to prevent unbounded Map growth across long sessions
- [ ] `notifications` array is never `.splice()`-d in a loop — use a single `shift()` or `slice()` operation for LRU eviction
- [ ] `visibleNotifications` is a `computed()` — not a method, watch, or manually-maintained derived array — ensuring Vue reactivity batches re-renders
- [ ] `dismiss(id)` uses `Array.findIndex()` + single `splice()` — not `filter()` which creates a new array reference unnecessarily for large queues

## Auto-Dismiss Timers

- [ ] Auto-dismiss `setTimeout` handles are stored per notification ID and cleared in `dismiss(id)` and `clearAll()` to prevent dangling timers after dismissal
- [ ] Unit tests for auto-dismiss use `vi.useFakeTimers()` — no real `setTimeout` delays in the test suite
- [ ] No `setInterval` used anywhere in the notification or error layer (event-driven only)

## Toast Rendering

- [ ] The `<Toaster>` component from `@zidney/ui-system` is mounted ONCE at root layout (`App.vue`) — never instantiated per-page, per-route, or per-component
- [ ] Toast entries are keyed by `notification.id` (stable string UUID) in `v-for` loops — prevents full list re-render when only one entry changes
- [ ] Maximum 5 toasts rendered simultaneously (`visibleNotifications.value.slice(-5)`) — O(1) slice, not a sort or filter over the full queue

## Offline Detection

- [ ] `useOnline()` from `@vueuse/core` is initialized ONCE at the root layout level — not called per-page or per-component
- [ ] Online/offline state transitions are event-driven (browser `online`/`offline` events via `@vueuse/core`) — no polling interval, no `setInterval`, no `fetch` ping
- [ ] The offline banner visibility is a reactive `computed(() => !isOnline.value)` — zero extra reactive dependencies

## Error Normalization

- [ ] `normalizeError()` is a pure function — no I/O, no network calls, no async operations
- [ ] `normalizeError()` for the `TypeError` path (network error) does not iterate over error properties or perform deep object inspection
- [ ] `redactError()` operates on the already-normalized `AppError` — not on raw response payloads (keeps hot error path minimal)

## Error Storm Protection

- [ ] Deduplication window (2-second key+type+message) prevents 50+ identical errors from flooding the queue in retry loops
- [ ] Internal queue hard cap (20 entries) + LRU eviction ensures memory is bounded regardless of error storm duration
- [ ] UI cap (5 visible) prevents DOM re-render thrash during rapid sequential pushes — only the visible slice is reactive

## Form / Loading State

- [ ] `isLoading` is a simple `ref<boolean>` — not a computed derived from multiple sources that would re-evaluate on unrelated state changes
- [ ] The submit button's `disabled` binding uses `:disabled="isLoading"` — not a method call binding that executes on every render
- [ ] `vee-validate` field errors are computed reactively by the library — no manual `watch` on form values for error display
- [ ] `<FormMessage>` only renders when an error string is non-empty — `v-if` (not `v-show`) to avoid invisible DOM nodes for every form field

## Build / Bundle

- [ ] `console.debug` in the notification/error layers is tree-shaken or stripped in production builds (Vite dead code elimination via `import.meta.env.PROD` guard)
- [ ] No new third-party runtime dependencies introduced by this stage (only `pinia`, `vue-sonner`, `@vueuse/core`, `@zidney/api-client` — all already in the monorepo)
- [ ] `useNotify()` composable is side-effect free at module evaluation time — safe for Vite's module graph optimization

## Testing Performance

- [ ] All notification store unit tests complete in < 100ms individually (no real timers, no real network)
- [ ] Deduplication expiry test uses `vi.advanceTimersByTime(2001)` — not a real 2-second `await` sleep
- [ ] Max queue test pushes 21+ items in a synchronous loop — no async operations needed
