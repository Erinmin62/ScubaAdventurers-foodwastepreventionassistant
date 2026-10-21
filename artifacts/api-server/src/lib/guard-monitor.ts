import { changeWorkspace } from "./guard-store";
import { runTwilioSandbox } from "./guard-sandbox";
import { createMonitorRunner } from "./monitor-runner";
import { db, guardWorkspace } from "@workspace/db";
import { inWorkspace, LEGACY_DEMO_WORKSPACE } from "./workspace-context";
import { logger } from "./logger";

// Persisted Sandbox send reservations in the shared database protect against
// duplicate sends even if multiple production processes are ever run.
export const runGuardMonitor = createMonitorRunner(async () => {
  const workspaces = await db.select({ id: guardWorkspace.id }).from(guardWorkspace);
  let failed = false;
  for (const { id } of workspaces) {
    if (!id.startsWith("owner:")) continue;
    try { await inWorkspace(id, () => changeWorkspace()); }
    catch { failed = true; logger.error("Owner workspace monitor failed"); }
  }
  // The original single-recipient Sandbox is exclusively synthetic. It must
  // never read an owner's records or deliver those to the demo recipient.
  await inWorkspace(LEGACY_DEMO_WORKSPACE, async () => {
    await changeWorkspace();
    await runTwilioSandbox({ mutate: changeWorkspace });
  });
  if (failed) throw new Error("One or more owner workspace checks failed.");
});
