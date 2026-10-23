import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { postgresEmailRepository } from "./postgres";
import { emailRecord, runEmailWorker } from "./runner";
import { sampleEmailWorkspace, testRoute } from "./email-worker.test-support";
import { scanEmailCandidates } from "./rules";
import type { EmailSender } from "./sender";
import { saveDeliveryEvent, emailHistory } from "./delivery-postgres";

if (process.env.REPLIT_DEPLOYMENT || process.env.NODE_ENV === "production") {
  throw new Error("Email worker database tests are restricted to development.");
}
after(async () => { await pool.end(); });

test("expiry-check status persists per owner, recovers, rejects older updates, and never changes inventory", async () => {
  const client = await pool.connect(), observer = await pool.connect();
  const workspaceId = `owner:expiry-status-test-${randomUUID()}`;
  const state = sampleEmailWorkspace();
  try {
    await client.query("INSERT INTO guard_workspace (id,data) VALUES ($1,$2::jsonb)", [workspaceId, JSON.stringify(state)]);
    const before = (await client.query(
      "SELECT data FROM guard_workspace WHERE id=$1", [workspaceId],
    )).rows[0].data;
    const repository = postgresEmailRepository(client);
    await repository.saveExpiryCheckStatus(workspaceId, "failed", "2026-10-22T02:00:00.000Z");
    let status = (await observer.query(
      "SELECT last_completed_at, outcome FROM guard_expiry_check_status WHERE workspace_id=$1", [workspaceId],
    )).rows[0];
    assert.equal(status.outcome, "failed");
    assert.equal(status.last_completed_at.toISOString(), "2026-10-22T02:00:00.000Z");

    await repository.saveExpiryCheckStatus(workspaceId, "success", "2026-10-22T03:00:00.000Z");
    await repository.saveExpiryCheckStatus(workspaceId, "failed", "2026-10-22T01:00:00.000Z");
    status = (await observer.query(
      "SELECT last_completed_at, outcome FROM guard_expiry_check_status WHERE workspace_id=$1", [workspaceId],
    )).rows[0];
    assert.equal(status.outcome, "success");
    assert.equal(status.last_completed_at.toISOString(), "2026-10-22T03:00:00.000Z");
    assert.deepEqual((await observer.query(
      "SELECT data FROM guard_workspace WHERE id=$1", [workspaceId],
    )).rows[0].data, before);
  } finally {
    await client.query("DELETE FROM guard_expiry_check_status WHERE workspace_id=$1", [workspaceId]);
    await client.query("DELETE FROM guard_workspace WHERE id=$1", [workspaceId]);
    client.release();
    observer.release();
  }
});

test("delivery receipts deduplicate across connections, survive early arrival and reorder without changing send audits or owner boundaries", async () => {
  const suffix = randomUUID();
  const owner = `owner:delivery-test-${suffix}`, otherOwner = `owner:delivery-other-${suffix}`;
  const client = await pool.connect();
  const emailId = `mock-email-${suffix}`, rowId = `delivery-row-${suffix}`;
  const before = "2026-10-22T01:00:00Z";
  const event = (id: string, type: Parameters<typeof saveDeliveryEvent>[0]["type"], occurredAt = before) => ({
    id: `${suffix}-${id}`, providerMessageId: emailId, type, occurredAt,
  });
  try {
    await pool.query("INSERT INTO guard_workspace (id,data) VALUES ($1,'{}'),($2,'{}')", [owner, otherOwner]);
    // Verified receipt may beat the worker's commit; it is retained without a guessed owner.
    await saveDeliveryEvent(event("early", "email.delivered"));
    assert.equal((await emailHistory(owner)).records.length, 0);
    await pool.query(`INSERT INTO guard_email_notifications
      (id,workspace_id,recipient_hash,kind,event_key,related_ids,scheduled_at,observed_at,status,message,attempts,accepted_at,provider_message_id)
      VALUES ($1,$2,'synthetic-hash','critical','test','[]',$3,$3,'accepted',
        '{"subject":"Synthetic email","text":"Do not expose body"}',1,$3,$4)`, [rowId, owner, before, emailId]);
    let history = await emailHistory(owner);
    assert.equal(history.records[0].deliveryStatus, "email.delivered");
    assert.equal(history.records[0].attemptStatus, "accepted");
    assert.equal((await emailHistory(otherOwner)).records.length, 0);
    await Promise.all(Array.from({ length: 5 }, () => saveDeliveryEvent(event("bounce", "email.bounced", "2026-10-22T02:00:00Z"))));
    assert.equal(Number((await pool.query("SELECT count(*) FROM guard_email_delivery_events WHERE id=$1", [`${suffix}-bounce`])).rows[0].count), 1);
    // Both older and newer non-failure events cannot hide terminal evidence.
    await saveDeliveryEvent(event("late-sent", "email.sent", "2026-10-22T03:00:00Z"));
    await saveDeliveryEvent(event("late-delivered", "email.delivered", "2026-10-22T04:00:00Z"));
    await saveDeliveryEvent(event("old-delay", "email.delivery_delayed"));
    history = await emailHistory(owner);
    assert.equal(history.records[0].deliveryStatus, "email.bounced");
    assert.equal(history.records[0].deliveryUpdatedAt.toISOString(), "2026-10-22T02:00:00.000Z");
    assert.equal(history.records[0].attemptStatus, "accepted");
    assert.equal(JSON.stringify(history).includes("synthetic-hash"), false);
    assert.equal(JSON.stringify(history).includes("Do not expose body"), false);
    await saveDeliveryEvent(event("complaint", "email.complained"));
    assert.equal((await emailHistory(owner)).records[0].deliveryStatus, "email.complained");
    await pool.query("UPDATE guard_email_notifications SET status='uncertain',provider_message_id=NULL WHERE id=$1", [rowId]);
    assert.equal((await emailHistory(owner)).records[0].deliveryStatus, "unconfirmed");
    assert.equal((await emailHistory(owner)).records[0].attemptStatus, "uncertain");
    const audit = (await pool.query("SELECT attempts,accepted_at FROM guard_email_notifications WHERE id=$1", [rowId])).rows[0];
    assert.equal(audit.attempts, 1);
    assert.equal(audit.accepted_at.toISOString(), "2026-10-22T01:00:00.000Z");
    assert.equal(await postgresEmailRepository(client).startAttempt(rowId, { subject: "test", text: "test" }, before), false);
  } finally {
    await pool.query("DELETE FROM guard_email_delivery_events WHERE provider_message_id=$1", [emailId]);
    await pool.query("DELETE FROM guard_workspace WHERE id=ANY($1::text[])", [[owner, otherOwner]]);
    client.release();
  }
});

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
