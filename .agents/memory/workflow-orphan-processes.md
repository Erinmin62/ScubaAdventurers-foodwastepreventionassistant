---
name: Orphaned workflow child processes
description: Recover artifact workflows when the managed process fails but an old child still holds its port.
---

An artifact workflow can show as failed while its Vite or API child process remains alive and continues holding the configured port. For `EADDRINUSE`, identify the listener and confirm its command and working directory belong to the exact artifact before stopping it; then restart the managed workflow once.

**Why:** Restarting the same command while an orphaned child still owns the port repeats the failure and can leave preview status misleading.

**How to apply:** Check the configured port, response, process command, and working directory. Stop only the confirmed stale app child, never unrelated services, and verify the managed workflow logs after restart.
