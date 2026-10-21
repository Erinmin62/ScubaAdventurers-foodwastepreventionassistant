// HTTP tests exercise the authenticated route without starting Twilio polling
// or sends. Production imports guard-monitor.ts instead.
import { changeWorkspace } from "./guard-store";
import { createMonitorRunner } from "./monitor-runner";

export const runGuardMonitor = createMonitorRunner(async () => {
  await changeWorkspace();
});
