import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { pool, type DatabaseClient } from "@workspace/db";
import { appendHistoricalRecords, changeWorkspace, readWorkspace, removeHistoricalBatch } from "./guard-store";
import { seed, shift, today, type Stored } from "./guard-model";
import { historicalArchive } from "./guard-history";
import { inWorkspace, ownerWorkspaceId } from "./workspace-context";

if (process.env.REPLIT_DEPLOYMENT || process.env.NODE_ENV === "production") {
  throw new Error("Workspace database tests are restricted to development.");
}
after(async () => { await pool.end(); });

async function waitForBlockedWriters(observer: DatabaseClient, pid: number, count: number) {
  // A queued writer can block another writer, so follow the entire lock chain.
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
    if (waiting >= count) break;
    await delay(20);
  } while (Date.now() < deadline);
  assert.equal(waiting, count, `${count} writers must overlap on separate PostgreSQL connections`);
}

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
    await waitForBlockedWriters(observer, pid, 2);
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

for (const firstWriter of ["remove", "import"] as const) {
  test(`PostgreSQL: removing an archive batch preserves an overlapping import (${firstWriter} queued first)`,
    { timeout: 20_000 }, async () => {
      const owner = ownerWorkspaceId(`history-remove-db-test-${randomUUID()}`);
      const original = seed();
      original.historicalRecords = [];
      const blocker = await pool.connect();
      const observer = await pool.connect();
      const writes: Promise<unknown>[] = [];
      let importPromise: ReturnType<typeof appendHistoricalRecords> | undefined;
      let removalPromise: ReturnType<typeof removeHistoricalBatch> | undefined;
      try {
        await observer.query("INSERT INTO guard_workspace (id, data) VALUES ($1, $2::jsonb)",
          [owner, JSON.stringify(original)]);
        const makeRows = (name: string) => [
          { kind: "stock" as const, date: shift(today(), -2), itemName: `${name} flour`, quantity: 2, unit: "kg" as const },
          { kind: "stock" as const, date: shift(today(), -1), itemName: `${name} milk`, quantity: 3, unit: "L" as const },
        ];
        const removed = await inWorkspace(owner, () => appendHistoricalRecords(makeRows("Old"), "old.csv"));
        const untouched = await inWorkspace(owner, () => appendHistoricalRecords(makeRows("Keep"), "keep.csv"));
        const removedBatchId = removed[0]!.batchId!;
        assert.ok(removedBatchId);
        assert.notEqual(removedBatchId, untouched[0]!.batchId);
        const rows = makeRows("New");

        await blocker.query("BEGIN");
        await blocker.query("SELECT id FROM guard_workspace WHERE id = $1 FOR UPDATE", [owner]);
        const { rows: [{ pid }] } = await blocker.query("SELECT pg_backend_pid() AS pid");
        const startWriter = (writer: typeof firstWriter) => {
          const promise = writer === "remove"
            ? (removalPromise = inWorkspace(owner, () => removeHistoricalBatch(removedBatchId)))
            : (importPromise = inWorkspace(owner, () => appendHistoricalRecords(rows, "new.csv")));
          writes.push(promise);
          // Observe rejections even when an overlap assertion fails.
          void promise.catch(() => {});
        };
        startWriter(firstWriter);
        await waitForBlockedWriters(observer, pid, 1);
        startWriter(firstWriter === "remove" ? "import" : "remove");
        await waitForBlockedWriters(observer, pid, 2);
        await blocker.query("COMMIT");
        await Promise.all(writes);
        assert.ok(removalPromise);
        assert.ok(await removalPromise, "the seeded batch must be found and removed");
        assert.ok(importPromise);
        const added = await importPromise;
        assert.equal(added.length, rows.length);
        assert.ok(added[0]!.batchId);
        assert.notEqual(added[0]!.batchId, removedBatchId);
        assert.notEqual(added[0]!.batchId, untouched[0]!.batchId);
        assert.ok(added.every(row => row.batchId === added[0]!.batchId && row.fileName === "new.csv"));
        assert.deepEqual(added.map(({ id, importedAt, batchId, fileName, ...row }) => row), rows);

        // Neither read reuses the document returned by either racing mutation.
        const reloaded = await inWorkspace(owner, readWorkspace);
        assert.ok(reloaded);
        const persisted = (await observer.query("SELECT data FROM guard_workspace WHERE id = $1", [owner])).rows[0].data as Stored;
        assert.deepEqual(reloaded, persisted, "store reload must agree with an independent PostgreSQL connection");
        assert.deepEqual(persisted.historicalRecords, [...untouched, ...added],
          "only the selected batch may disappear; untouched and newly imported rows must survive intact");
        const archive = historicalArchive(reloaded.historicalRecords);
        assert.equal(archive.records.length, 4);
        assert.equal(new Set(archive.records.map(row => row.id)).size, 4);
        assert.equal(archive.batches.length, 2);
        assert.ok(!archive.records.some(row => row.batchId === removedBatchId));
        for (const batch of [untouched, added]) {
          assert.equal(archive.batches.find(value => value.id === batch[0]!.batchId)?.recordCount, 2);
        }
        assert.deepEqual({ ...persisted, historicalRecords: [] }, original,
          "archive removal and import must not change operational data");
      } finally {
        // Release the lock before draining writers, then delete only this test's owner.
        try {
          await blocker.query("ROLLBACK");
          await Promise.allSettled(writes);
          await observer.query("DELETE FROM guard_workspace WHERE id = $1", [owner]);
          const remaining = await observer.query("SELECT id FROM guard_workspace WHERE id = $1", [owner]);
          assert.equal(remaining.rowCount, 0, "temporary workspace must be removed");
        } finally {
          blocker.release();
          observer.release();
        }
      }
    });
}

for (const firstWriter of ["remove", "import"] as const) {
  test(`PostgreSQL: removing an already-removed batch preserves an overlapping import (${firstWriter} queued first)`,
    { timeout: 20_000 }, async () => {
      const owner = ownerWorkspaceId(`history-noop-remove-db-test-${randomUUID()}`);
      const original = seed();
      original.historicalRecords = [];
      const blocker = await pool.connect();
      const observer = await pool.connect();
      const writes: Promise<unknown>[] = [];
      let importPromise: ReturnType<typeof appendHistoricalRecords> | undefined;
      let removalPromise: ReturnType<typeof removeHistoricalBatch> | undefined;
      try {
        await observer.query("INSERT INTO guard_workspace (id, data) VALUES ($1, $2::jsonb)",
          [owner, JSON.stringify(original)]);
        const makeRows = (name: string) => [
          { kind: "stock" as const, date: shift(today(), -2), itemName: `${name} flour`, quantity: 2, unit: "kg" as const },
          { kind: "stock" as const, date: shift(today(), -1), itemName: `${name} milk`, quantity: 3, unit: "L" as const },
        ];
        const existing = await inWorkspace(owner, () => appendHistoricalRecords(makeRows("Keep"), "keep.csv"));
        const removed = await inWorkspace(owner, () => appendHistoricalRecords(makeRows("Remove"), "removed.csv"));
        const removedBatchId = removed[0]!.batchId!;
        assert.ok(removedBatchId);
        assert.ok(await inWorkspace(owner, () => removeHistoricalBatch(removedBatchId)));
        const baseline = await inWorkspace(owner, readWorkspace);
        assert.ok(baseline);
        assert.deepEqual(baseline.historicalRecords, existing);

        const rows = makeRows("New");
        await blocker.query("BEGIN");
        await blocker.query("SELECT id FROM guard_workspace WHERE id = $1 FOR UPDATE", [owner]);
        const { rows: [{ pid }] } = await blocker.query("SELECT pg_backend_pid() AS pid");
        const startWriter = (writer: typeof firstWriter) => {
          const promise = writer === "remove"
            ? (removalPromise = inWorkspace(owner, () => removeHistoricalBatch(removedBatchId)))
            : (importPromise = inWorkspace(owner, () => appendHistoricalRecords(rows, "new.csv")));
          writes.push(promise);
          // Observe rejections immediately, even if a lock assertion later fails.
          void promise.catch(() => {});
        };
        startWriter(firstWriter);
        await waitForBlockedWriters(observer, pid, 1);
        startWriter(firstWriter === "remove" ? "import" : "remove");
        await waitForBlockedWriters(observer, pid, 2);
        await blocker.query("COMMIT");
        await Promise.all(writes);

        assert.ok(removalPromise);
        assert.equal(await removalPromise, null, "a batch removed before the overlap must remain a no-op");
        assert.ok(importPromise);
        const added = await importPromise;
        assert.equal(added.length, rows.length);
        assert.ok(added[0]!.batchId);
        assert.notEqual(added[0]!.batchId, removedBatchId);
        assert.ok(added.every(row => row.batchId === added[0]!.batchId && row.fileName === "new.csv"));
        assert.deepEqual(added.map(({ id, importedAt, batchId, fileName, ...row }) => row), rows);

        // Reload from the store and independently from PostgreSQL; neither read
        // reuses a document returned by one of the racing mutations.
        const reloaded = await inWorkspace(owner, readWorkspace);
        assert.ok(reloaded);
        const persisted = (await observer.query("SELECT data FROM guard_workspace WHERE id = $1", [owner])).rows[0].data as Stored;
        assert.deepEqual(reloaded, persisted, "store reload must agree with an independent PostgreSQL connection");
        assert.deepEqual(persisted.historicalRecords, [...existing, ...added],
          "a no-op removal must not discard existing history or any row from the new import");
        const archive = historicalArchive(reloaded.historicalRecords);
        assert.equal(archive.records.length, 4);
        assert.equal(new Set(archive.records.map(row => row.id)).size, 4);
        assert.equal(archive.batches.length, 2);
        assert.ok(!archive.records.some(row => row.batchId === removedBatchId));
        assert.equal(archive.batches.find(batch => batch.id === existing[0]!.batchId)?.recordCount, 2);
        assert.equal(archive.batches.find(batch => batch.id === added[0]!.batchId)?.recordCount, 2);
        assert.deepEqual({ ...persisted, historicalRecords: [] }, original,
          "archive removal and import must not change operational data");
      } finally {
        // Unblock pending writers even on assertion failure, then delete only this test's workspace.
        try {
          await blocker.query("ROLLBACK");
          await Promise.allSettled(writes);
          await observer.query("DELETE FROM guard_workspace WHERE id = $1", [owner]);
          const remaining = await observer.query("SELECT id FROM guard_workspace WHERE id = $1", [owner]);
          assert.equal(remaining.rowCount, 0, "temporary workspace must be removed");
        } finally {
          blocker.release();
          observer.release();
        }
      }
    });
}

for (const firstWriter of ["inventory", "archive"] as const) {
  test(`PostgreSQL: inventory edit and archive import both survive reload (${firstWriter} queued first)`,
    { timeout: 20_000 }, async () => {
      const owner = ownerWorkspaceId(`history-stock-db-test-${randomUUID()}`);
      const original = seed();
      const date = today();
      // Keep an existing archive row as well as both newly imported rows.
      original.historicalRecords = [{
        id: randomUUID(), batchId: randomUUID(), fileName: "existing.csv",
        importedAt: new Date().toISOString(), kind: "stock",
        date: shift(date, -3), itemName: "Existing flour", quantity: 2, unit: "kg",
      }];
      const blocker = await pool.connect();
      const observer = await pool.connect();
      const writes: Promise<unknown>[] = [];
      let importPromise: ReturnType<typeof appendHistoricalRecords> | undefined;
      try {
        await observer.query("INSERT INTO guard_workspace (id, data) VALUES ($1, $2::jsonb)",
          [owner, JSON.stringify(original)]);
        // Initialize normal migrations/inbox state before taking the baseline.
        await inWorkspace(owner, () => changeWorkspace(() => {}, false));
        const baseline = await inWorkspace(owner, readWorkspace);
        assert.ok(baseline);
        const expected = structuredClone(baseline);
        const ingredient = expected.ingredients.find(item => item.id === "tomato");
        assert.ok(ingredient);
        Object.assign(ingredient, {
          quantity: 17.25, cost: 19.5, expiry: shift(date, 5),
          deliveryQuantity: 9, deliveryDate: shift(date, 4),
          measuredDate: date,
          batches: [{ id: randomUUID(), quantity: 17.25, expiry: shift(date, 5), receivedDate: date }],
        });
        const rows = [
          { kind: "stock" as const, date: shift(date, -2), itemName: ingredient.name, quantity: 99, unit: "kg" as const },
          { kind: "sales" as const, date: shift(date, -1), menuId: "avo-toast", menuName: "Avocado Toast", quantity: 43, unit: "portions" as const },
        ];
        await blocker.query("BEGIN");
        await blocker.query("SELECT id FROM guard_workspace WHERE id = $1 FOR UPDATE", [owner]);
        const { rows: [{ pid }] } = await blocker.query("SELECT pg_backend_pid() AS pid");

        const startWriter = (writer: typeof firstWriter) => {
          const promise = writer === "inventory"
            ? inWorkspace(owner, () => changeWorkspace(stored => {
              const target = stored.ingredients.find(item => item.id === ingredient.id);
              assert.ok(target);
              Object.assign(target, ingredient);
            }, false))
            : (importPromise = inWorkspace(owner, () => appendHistoricalRecords(rows, "racing-stock.csv")));
          writes.push(promise);
          // Observe rejections immediately, even if a lock assertion later fails.
          void promise.catch(() => {});
        };
        startWriter(firstWriter);
        await waitForBlockedWriters(observer, pid, 1);
        startWriter(firstWriter === "inventory" ? "archive" : "inventory");
        await waitForBlockedWriters(observer, pid, 2);
        await blocker.query("COMMIT");
        await Promise.all(writes);
        assert.ok(importPromise);
        const added = await importPromise;
        assert.equal(added.length, rows.length);
        assert.ok(added[0]!.batchId);
        assert.ok(added.every(row => row.batchId === added[0]!.batchId && row.fileName === "racing-stock.csv"));
        assert.deepEqual(added.map(({ id, importedAt, batchId, fileName, ...row }) => row), rows);

        // These reads do not reuse either mutation's returned state.
        const reloaded = await inWorkspace(owner, readWorkspace);
        assert.ok(reloaded);
        const persisted = (await observer.query("SELECT data FROM guard_workspace WHERE id = $1", [owner])).rows[0].data as Stored;
        assert.deepEqual(reloaded, persisted, "store reload must agree with an independent PostgreSQL connection");
        assert.deepEqual(persisted.historicalRecords, [...baseline.historicalRecords!, ...added],
          "existing history and the complete imported batch must survive the inventory edit");
        assert.equal(new Set(persisted.historicalRecords!.map(row => row.id)).size, 3);
        // Inbox/notification scans are legitimate changeWorkspace side effects,
        // but no operational field may revert or change because of the import.
        const operational = ({ historicalRecords, inbox, notifications, ...rest }: Stored) => rest;
        assert.deepEqual(operational(persisted), operational(expected),
          "all edited stock values and unrelated operational data must survive the archive import");
      } finally {
        // Release the lock before draining pending work, including on failure.
        try {
          await blocker.query("ROLLBACK");
          await Promise.allSettled(writes);
          await observer.query("DELETE FROM guard_workspace WHERE id = $1", [owner]);
          const remaining = await observer.query("SELECT id FROM guard_workspace WHERE id = $1", [owner]);
          assert.equal(remaining.rowCount, 0, "temporary workspace must be removed");
        } finally {
          blocker.release();
          observer.release();
        }
      }
    });
}
