---
name: API test bundle isolation
description: Keep temporary artifacts from different API test runners from being picked up by shared globs.
---

**Rule:** When adding a test that needs a separate CommonJS runner, use a distinct `/tmp` output path from the ESM suite's globbed test output.

**Why:** The API test script bundles ESM tests into a shared temporary directory and runs a wildcard over it. Stale output from a separately compiled test can be discovered on a later run and fail for an unrelated module-loading reason.

**How to apply:** Prefer each test runner's dedicated temp directory, or clear the shared test output before running when switching runner formats.
