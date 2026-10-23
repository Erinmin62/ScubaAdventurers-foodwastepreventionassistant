---
name: Preview session verification
description: Fresh screenshots may not reproduce failures retained in an already-open development tab.
---

When a user reports a page error despite a passing fresh screenshot, inspect the existing browser logs rather than treating the screenshot as disproof.

**Why:** The Today page rendered correctly in a fresh capture while the user's open preview had recorded invalid React-hook errors during live updates. An open tab can retain a failed dependency graph or a caught error after the underlying files have changed.

**How to apply:** Distinguish fresh-load verification from recovery of an existing failed session. Investigate the recorded error, preserve ordinary application errors for diagnosis, and avoid unbounded reload/retry loops.
