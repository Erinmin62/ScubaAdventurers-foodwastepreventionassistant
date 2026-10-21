import { changeWorkspace } from "./guard-store";
import { runTwilioSandbox } from "./guard-sandbox";
import { createMonitorRunner } from "./monitor-runner";

// Persisted Sandbox send reservations in the shared database protect against
// duplicate sends even if multiple production processes are ever run.
export const runGuardMonitor = createMonitorRunner(async () => {
  await changeWorkspace();
  await runTwilioSandbox({ mutate: changeWorkspace });
});
