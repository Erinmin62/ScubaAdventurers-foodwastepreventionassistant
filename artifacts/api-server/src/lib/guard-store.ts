import { db, guardWorkspace } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetGuardStateResponse } from "@workspace/api-zod";
import { compute, seed, type HistoricalRecord, type Stored } from "./guard-model";
import { runWorkflows } from "./guard-automation";
import { scanNotificationEvents } from "./guard-notifications";
import { migrateBatches } from "./guard-batches";
import { syncInbox } from "./guard-inbox";
import { currentWorkspaceId } from "./workspace-context";
import { removeArchiveBatch } from "./guard-history";

export async function changeWorkspace(action: (s: Stored) => void = () => {}, autoRun = true) {
  const id = currentWorkspaceId();
  await db.insert(guardWorkspace).values({ id, data: seed() }).onConflictDoNothing();
  return db.transaction(async tx => {
    const [record] = await tx.select().from(guardWorkspace).where(eq(guardWorkspace.id, id)).for("update");
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
      await tx.update(guardWorkspace).set({ data: stored }).where(eq(guardWorkspace.id, id));
    }
    return state;
  });
}

/** Read the persisted workspace document without migrations, analysis, or writes. */
export async function readWorkspace(): Promise<Stored | null> {
  const id = currentWorkspaceId();
  const [record] = await db.select({ data: guardWorkspace.data }).from(guardWorkspace).where(eq(guardWorkspace.id, id));
  return record ? record.data as Stored : null;
}

/** Append only to the isolated historical archive; do not run planning or mutate operational fields. */
export async function appendHistoricalRecords(
  records: Omit<HistoricalRecord, "id" | "importedAt" | "batchId" | "fileName">[],
  fileName = "Unnamed import",
): Promise<HistoricalRecord[]> {
  const id = currentWorkspaceId();
  await db.insert(guardWorkspace).values({ id, data: seed() }).onConflictDoNothing();
  return db.transaction(async tx => {
    const [record] = await tx.select().from(guardWorkspace).where(eq(guardWorkspace.id, id)).for("update");
    if (!record) throw new Error("Workspace unavailable.");
    const stored = record.data as Stored;
    const importedAt = new Date().toISOString();
    const batchId = crypto.randomUUID();
    const added = records.map(value => ({ ...value, id: crypto.randomUUID(), importedAt, batchId, fileName }));
    stored.historicalRecords ??= [];
    stored.historicalRecords.push(...added);
    await tx.update(guardWorkspace).set({ data: stored }).where(eq(guardWorkspace.id, id));
    return added;
  });
}

/** Lock the owner's document, remove only archive rows, and do not invoke changeWorkspace. */
export async function removeHistoricalBatch(batchId: string): Promise<HistoricalRecord[] | null> {
  const id = currentWorkspaceId();
  return db.transaction(async tx => {
    const [record] = await tx.select().from(guardWorkspace).where(eq(guardWorkspace.id, id)).for("update");
    if (!record) return null;
    const stored = record.data as Stored;
    if (!removeArchiveBatch(stored, batchId)) return null;
    await tx.update(guardWorkspace).set({ data: stored }).where(eq(guardWorkspace.id, id));
    return stored.historicalRecords ?? [];
  });
}
