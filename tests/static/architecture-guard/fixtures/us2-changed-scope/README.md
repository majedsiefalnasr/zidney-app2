# US2 Changed Scope Fixtures

This fixture set documents expected changed-mode scope behavior for unified architecture guard tests.

- changed file in one module should include that module
- reverse dependency expansion may include dependent modules
- missing graph should trigger deterministic fallback reason
