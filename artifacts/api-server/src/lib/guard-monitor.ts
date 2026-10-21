import { changeWorkspace } from "./guard-store";
import { runTwilioSandbox } from "./guard-sandbox";
import { createMonitorRunner } from "./monitor-runner";
import { db, guardWorkspace } from "@workspace/db";
import { inWorkspace, LEGACY_DEMO_WORKSPACE } from "./workspace-context";
import { logger } from "./logger";
import { recordMonitorHeartbeat } from "./monitor-heartbeat";

// Persisted Sandbox send reservations in the shared database protect against
// duplicate sends even if multiple production processes are ever run.
export const runGuardMonitor = createMonitorRunner(async () => {
  const workspaces = await db.select({ id: guardWorkspace.id }).from(guardWorkspace);
  let failed = false;
  for (const { id } of workspaces) {
    if (!id.startsWith("owner:")) continue;
    try {
      await inWorkspace(id, () => changeWorkspace());
      const checkedAt = new Date().toISOString();
      await inWorkspace(id, () => changeWorkspace(s => recordMonitorHeartbeat(s, "success", checkedAt), false));
    } catch {
      failed = true;
      logger.error("Owner workspace monitor failed");
      try {
        const failedAt = new Date().toISOString();
        await inWorkspace(id, () => changeWorkspace(s => recordMonitorHeartbeat(s, "failure", failedAt), false));
      } catch {
        logger.error("Unable to persist owner workspace monitor failure");
      }
    }
  }
  // The original single-recipient Sandbox is exclusively synthetic. It must
  // never read an owner's records or deliver those to the demo recipient.
  await inWorkspace(LEGACY_DEMO_WORKSPACE, async () => {
    await changeWorkspace();
    await runTwilioSandbox({ mutate: changeWorkspace });
  });
  if (failed) throw new Error("One or more owner workspace checks failed.");
});
