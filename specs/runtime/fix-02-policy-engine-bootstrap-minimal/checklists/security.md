# Security Checklist — Policy Engine Bootstrap Minimal

## Input Validation

- [ ] CLI args parsed safely (no command injection via process.argv)
- [ ] Policy mode only accepts "full" or "changed" — unknown args are ignored safely
- [ ] No user-supplied input is passed to eval() or dynamic import() calls

## Dependency Security

- [ ] No new external npm packages introduced
- [ ] No dynamic requires with user-controlled strings

## Import Boundaries

- [ ] scripts/policy-engine/_.ts does not import from apps/_
- [ ] scripts/policy-engine/_.ts does not import from packages/_
- [ ] No circular imports within scripts/policy-engine/

## Information Disclosure

- [ ] Error messages do not expose internal stack traces to output
- [ ] runner.ts prints only "Policy check passed" or "Policy check failed" as final output

## Code Safety

- [ ] No use of process.exit() outside runner.ts
- [ ] No side effects in types.ts or registry.ts (pure exports)
