import { db, guardWorkspace } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetGuardStateResponse } from "@workspace/api-zod";
import { compute, seed, type Stored } from "./guard-model";
import { runWorkflows } from "./guard-automation";
import { scanNotificationEvents } from "./guard-notifications";
import { migrateBatches } from "./guard-batches";
import { syncInbox } from "./guard-inbox";

export async function changeWorkspace(action: (s: Stored) => void = () => {}, autoRun = true) {
  await db.insert(guardWorkspace).values({ id: "demo", data: seed() }).onConflictDoNothing();
  return db.transaction(async tx => {
    const [record] = await tx.select().from(guardWorkspace).where(eq(guardWorkspace.id, "demo")).for("update");
    if (!record) throw new Error("Workspace unavailable.");
    const stored = record.data as Stored;
    const before = JSON.stringify(stored);
    migrateBatches(stored);
    action(stored);
    if (autoRun) runWorkflows(stored);
    scanNotificationEvents(stored);
    syncInbox(stored);
    const state = GetGuardStateResponse.parse(compute(stored));
    if (JSON.stringify(stored) !== before) {
      await tx.update(guardWorkspace).set({ data: stored }).where(eq(guardWorkspace.id, "demo"));
    }
    return state;
  });
}
