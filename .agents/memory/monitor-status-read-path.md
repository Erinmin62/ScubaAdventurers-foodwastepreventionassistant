---
name: Read-only monitor status
description: Preserve strict read-only behavior when displaying the owner workspace monitor heartbeat.
---

Use a direct read-only workspace read for status-only endpoints; do not route them through `changeWorkspace(..., false)`.

**Why:** Disabling automatic workflows does not make `changeWorkspace` read-only. It still migrates legacy batches, scans notification events, synchronizes the inbox, and can persist the resulting document.

**How to apply:** For heartbeat/status views, select the stored workspace without migrations or writes, project only the public status fields, and test that the whole stored document is unchanged after the request.
