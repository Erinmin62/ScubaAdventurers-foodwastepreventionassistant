import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { postgresEmailRepository } from "./postgres";
import { emailRecord, runEmailWorker } from "./runner";
import { sampleEmailWorkspace, testRoute } from "./email-worker.test-support";
import { scanEmailCandidates } from "./rules";
import type { EmailSender } from "./sender";

if (process.env.REPLIT_DEPLOYMENT || process.env.NODE_ENV === "production") {
  throw new Error("Email worker database tests are restricted to development.");
}
after(async () => { await pool.end(); });

test("PostgreSQL worker persists deduplication across connections, excludes overlaps, survives interrupted attempts, and never writes inventory", async () => {
  const client = await pool.connect(), other = await pool.connect();
  const workspaceId = `owner:email-worker-test-${randomUUID()}`;
  const route = { ...testRoute, workspaceId };
  const now = new Date("2026-10-22T02:00:00Z");
  const state = sampleEmailWorkspace(now);
  let locked = false;
  try {
    await client.query("INSERT INTO guard_workspace (id,data) VALUES ($1,$2::jsonb)", [workspaceId, JSON.stringify(state)]);
    const repository = postgresEmailRepository(client), restarted = postgresEmailRepository(other);
    const original = (await client.query("SELECT data FROM guard_workspace WHERE id=$1", [workspaceId])).rows[0].data;
    let calls = 0;
    const sender: EmailSender = async id => { calls++; return { status: "accepted", providerId: `mock-${id}` }; };
    const options = { dryRun: false, routes: [route], clock: () => now, pause: async () => {}, sender };
    locked = await repository.lock();
    assert.equal(locked, true);
    assert.equal((await runEmailWorker(restarted, options)).overlapSkipped, true);
    await repository.unlock(); locked = false;

    const dry = await runEmailWorker(repository, { ...options, dryRun: true });
    assert.ok(dry.wouldSend > 0);
    assert.equal((await repository.records(workspaceId, route.recipientHash)).length, 0);
    assert.equal(calls, 0);
    assert.equal((await runEmailWorker(repository, options)).sent, 2);
    const persisted = await restarted.records(workspaceId, route.recipientHash);
    assert.equal(persisted.filter(row => row.status === "accepted").length, 2);
    assert.equal(persisted.filter(row => row.kind === "approval_reminder" && row.status === "queued").length, 1);
    assert.equal((await runEmailWorker(restarted, options)).sent, 0);
    assert.equal(calls, 2);

    const future = { ...options, clock: () => new Date(now.getTime() + 24 * 3600_000) };
    assert.equal((await runEmailWorker(restarted, future)).sent, 1);
    assert.equal((await runEmailWorker(repository, future)).sent, 0);
    const candidate = scanEmailCandidates(state, now).candidates[0]!;
    const crash = emailRecord({ ...candidate, eventKey: "interrupted-test-event" }, workspaceId, route.recipientHash, now);
    await repository.enqueue(crash);
    const reservations = await Promise.all([
      repository.startAttempt(crash.id, crash.message, now.toISOString()),
      restarted.startAttempt(crash.id, crash.message, now.toISOString()),
    ]);
    assert.equal(reservations.filter(Boolean).length, 1);
    const beforeRecovery = calls;
    const recovery = await runEmailWorker(restarted, future);
    assert.equal(recovery.uncertain, 1);
    assert.equal(calls, beforeRecovery);
    assert.equal((await repository.records(workspaceId, route.recipientHash)).find(row => row.id === crash.id)!.status, "uncertain");
    assert.deepEqual((await client.query("SELECT data FROM guard_workspace WHERE id=$1", [workspaceId])).rows[0].data, original);
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock(18471,39012)");
    await client.query("DELETE FROM guard_workspace WHERE id=$1", [workspaceId]);
    client.release(); other.release();
  }
});
