import type { HistoricalRecord, Stored } from "./guard-model";

// Old imports shared a server timestamp but did not retain a file name.
export function historicalBatchId(record: HistoricalRecord): string {
  return record.batchId ?? `legacy:${record.importedAt}`;
}

export function historicalArchive(records: HistoricalRecord[] = []) {
  const batches = new Map<string, { id: string; fileName: string; importedAt: string; recordCount: number }>();
  const normalized = records.map(record => {
    const batchId = historicalBatchId(record);
    const fileName = record.fileName ?? "Earlier import (file name unavailable)";
    const batch = batches.get(batchId);
    if (batch) batch.recordCount++;
    else batches.set(batchId, { id: batchId, fileName, importedAt: record.importedAt, recordCount: 1 });
    return { ...record, batchId, fileName };
  });
  return { records: normalized, batches: [...batches.values()].sort((a, b) => b.importedAt.localeCompare(a.importedAt)) };
}

/** Deliberately touch no operational fields and run no planning/automation. */
export function removeArchiveBatch(stored: Stored, batchId: string): boolean {
  const records = stored.historicalRecords ?? [];
  const remaining = records.filter(record => historicalBatchId(record) !== batchId);
  if (remaining.length === records.length) return false;
  stored.historicalRecords = remaining;
  return true;
}
