import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { pool } from "@workspace/db";
import { appendHistoricalRecords, readWorkspace, removeHistoricalBatch } from "./guard-store";
import { seed, shift, today, type Stored } from "./guard-model";
import { historicalArchive } from "./guard-history";
import { inWorkspace, ownerWorkspaceId } from "./workspace-context";

if (process.env.REPLIT_DEPLOYMENT || process.env.NODE_ENV === "production") {
  throw new Error("Workspace database tests are restricted to development.");
}
after(async () => { await pool.end(); });

test("PostgreSQL: simultaneous history imports retain both batches after reload and stay private to their owner", { timeout: 20_000 }, async () => {
  const owner = ownerWorkspaceId(`history-db-test-${randomUUID()}`);
  const otherOwner = ownerWorkspaceId(`history-db-test-${randomUUID()}`);
  const original = seed();
  original.historicalRecords = [];
  const blocker = await pool.connect();
  const observer = await pool.connect();
  let imports: ReturnType<typeof appendHistoricalRecords>[] = [];
  try {
    await observer.query("INSERT INTO guard_workspace (id, data) VALUES ($1, $3::jsonb), ($2, $3::jsonb)",
      [owner, otherOwner, JSON.stringify(original)]);
    await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM guard_workspace WHERE id = $1 FOR UPDATE", [owner]);
    const { rows: [{ pid }] } = await blocker.query("SELECT pg_backend_pid() AS pid");

    imports = ["first.csv", "second.csv"].map((fileName, index) => inWorkspace(owner, () =>
      appendHistoricalRecords([
        { kind: "stock", date: shift(today(), -2), itemName: `${fileName} flour`, quantity: index + 1, unit: "kg" },
        { kind: "stock", date: shift(today(), -1), itemName: `${fileName} milk`, quantity: index + 3, unit: "L" },
      ], fileName)));
    // Attach rejection handlers immediately, including if the overlap assertion fails.
    const settled = Promise.allSettled(imports);
    // Follow the lock chain: the second writer may queue behind the first writer
    // rather than directly behind our blocker. Do not rely on scheduling or sleeps
    // alone to establish that both real database transactions are in flight.
    const deadline = Date.now() + 5_000;
    let waiting = 0;
    do {
      const result = await observer.query(`
        WITH RECURSIVE blocked(pid) AS (
          SELECT $1::int
          UNION
          SELECT activity.pid FROM pg_stat_activity activity
          JOIN blocked parent ON parent.pid = ANY(pg_blocking_pids(activity.pid))
        )
        SELECT count(*)::int AS count FROM blocked WHERE pid <> $1::int
      `, [pid]);
      waiting = result.rows[0].count;
      if (waiting >= 2) break;
      await delay(20);
    } while (Date.now() < deadline);
    assert.equal(waiting, 2, "both imports must overlap on separate PostgreSQL connections");
    await blocker.query("COMMIT");
    await settled;
    const [first, second] = await Promise.all(imports);
    assert.equal(first.length, 2);
    assert.equal(second.length, 2);
    assert.ok(first[0]!.batchId);
    assert.ok(second[0]!.batchId);
    assert.notEqual(first[0]!.batchId, second[0]!.batchId);

    // Reload through the real store and independently through another connection.
    const reloaded = await inWorkspace(owner, readWorkspace);
    assert.ok(reloaded);
    const persisted = (await observer.query("SELECT data FROM guard_workspace WHERE id = $1", [owner])).rows[0].data as Stored;
    assert.deepEqual(reloaded, persisted);
    const archive = historicalArchive(reloaded.historicalRecords);
    assert.equal(archive.records.length, 4);
    assert.equal(archive.batches.length, 2);
    for (const [added, fileName] of [[first, "first.csv"], [second, "second.csv"]] as const) {
      assert.deepEqual(archive.records.filter(row => row.batchId === added[0]!.batchId), added);
      assert.ok(added.every(row => row.batchId === added[0]!.batchId && row.fileName === fileName));
      assert.equal(archive.batches.find(batch => batch.id === added[0]!.batchId)?.recordCount, 2);
    }
    assert.equal(new Set(archive.records.map(row => row.id)).size, 4);
    assert.deepEqual({ ...persisted, historicalRecords: [] }, original, "imports must not change operational data");

    const other = await inWorkspace(otherOwner, readWorkspace);
    assert.deepEqual(other, original, "a different owner must not see either imported batch");
    for (const batch of archive.batches) {
      assert.equal(await inWorkspace(otherOwner, () => removeHistoricalBatch(batch.id)), null,
        "knowing a batch ID must not allow another owner to remove it");
    }
    assert.deepEqual(await inWorkspace(owner, readWorkspace), persisted);
    assert.deepEqual(await inWorkspace(otherOwner, readWorkspace), original);
  } finally {
    // Unblock writers even on assertion failure, then clean up only our unique IDs.
    await blocker.query("ROLLBACK");
    await Promise.allSettled(imports);
    await observer.query("DELETE FROM guard_workspace WHERE id IN ($1, $2)", [owner, otherOwner]);
    blocker.release();
    observer.release();
  }
});
