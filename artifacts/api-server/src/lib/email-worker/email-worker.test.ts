import { test } from "node:test";
import assert from "node:assert/strict";
import { emailRoutes, providerConfig } from "./config";
import { emailRecord, runEmailWorker } from "./runner";
import { klDay, scanEmailCandidates } from "./rules";
import { resendSender, type EmailSender } from "./sender";
import { MemoryEmailRepository, sampleEmailWorkspace, testRoute } from "./email-worker.test-support";
import { seed, shift } from "../guard-model";

const now = new Date("2026-10-22T02:00:00Z");
const clock = () => new Date(now);
const pause = async () => {};
const accepted: EmailSender = async id => ({ status: "accepted", providerId: `test-${id}` });
function repository() { return new MemoryEmailRepository([{ id: testRoute.workspaceId, data: sampleEmailWorkspace() }]); }

test("email rules separate critical batches and the 2–3 day digest, validate dates and never change workspace", () => {
  const state = sampleEmailWorkspace();
  const ingredient = state.ingredients[0]!;
  ingredient.batches = [-1, 0, 1, 2, 3, 4].map(days => ({
    id: `batch-${days}`, quantity: 1, expiry: shift("2026-10-22", days), receivedDate: null,
  }));
  ingredient.batches.push({ id: "empty", quantity: 0, expiry: "2026-10-21", receivedDate: null });
  const before = structuredClone(state);
  const result = scanEmailCandidates(state, now);
  assert.equal(result.candidates.filter(row => row.kind === "critical_expiry").length, 3);
  const digest = result.candidates.find(row => row.kind === "daily_digest")!;
  assert.equal(digest.relatedIds.length, 2);
  assert.match(digest.message.text, /RM10.00/);
  assert.match(result.candidates[0]!.message.text, /Do not consume, prepare or sell expired/);
  assert.deepEqual(state, before);
  ingredient.batches.push({ id: "invalid", quantity: NaN, expiry: "2026-02-30", receivedDate: null });
  const invalid = scanEmailCandidates(state, now);
  assert.equal(invalid.invalidRecords, 1);
  assert.ok(invalid.candidates.every(row => !row.message.text.includes("NaN")));
});

test("email calendar follows KL midnight rather than UTC midnight and handles next-day expiry conservatively", () => {
  assert.equal(klDay(new Date("2026-10-22T15:59:59Z")), "2026-10-22");
  assert.equal(klDay(new Date("2026-10-22T16:00:00Z")), "2026-10-23");
  const state = sampleEmailWorkspace();
  state.ingredients[0]!.expiry = "2026-10-24";
  assert.ok(scanEmailCandidates(state, new Date("2026-10-22T15:59:59Z")).candidates.some(row => row.kind === "daily_digest"));
  assert.ok(scanEmailCandidates(state, new Date("2026-10-22T16:00:00Z")).candidates.some(row => row.kind === "critical_expiry"));
});

test("email dry-run previews without sender calls or any persistent writes", async () => {
  const repo = repository(), before = structuredClone(repo.workspaceRows);
  let calls = 0;
  const result = await runEmailWorker(repo, { dryRun: true, routes: [], clock, sender: async () => { calls++; throw new Error("must not send"); } });
  assert.ok(result.wouldSend > 0); assert.equal(calls, 0); assert.equal(repo.writes, 0);
  assert.deepEqual(repo.workspaceRows, before);
});

test("email repeat runs deduplicate; pending reminder waits a full 24 hours, then sends only once", async () => {
  const repo = repository(), before = structuredClone(repo.workspaceRows);
  let time = new Date(now), calls = 0;
  const options = { dryRun: false, routes: [testRoute], clock: () => time, pause,
    sender: (async id => { calls++; return accepted(id, "", { subject: "", text: "" }); }) as EmailSender };
  const first = await runEmailWorker(repo, options);
  assert.equal(first.sent, 2);
  assert.equal((await runEmailWorker(repo, options)).sent, 0);
  time = new Date(now.getTime() + 24 * 3600_000 - 1);
  assert.equal((await runEmailWorker(repo, options)).sent, 0);
  time = new Date(now.getTime() + 24 * 3600_000);
  assert.equal((await runEmailWorker(repo, options)).sent, 1);
  assert.equal((await runEmailWorker(repo, options)).sent, 0);
  assert.equal(calls, 3);
  assert.deepEqual(repo.workspaceRows, before);
});

test("email resolved approvals cancel their queued reminder, and superseded or rejected plans are not sent", async () => {
  for (const status of ["EXECUTED", "REJECTED", "SUPERSEDED"] as const) {
    const repo = repository();
    await runEmailWorker(repo, { dryRun: false, routes: [testRoute], clock, pause, sender: accepted });
    repo.workspaceRows[0]!.data.reordering!.plans[0]!.status = status;
    const result = await runEmailWorker(repo, {
      dryRun: false, routes: [testRoute], pause, sender: accepted,
      clock: () => new Date(now.getTime() + 25 * 3600_000),
    });
    assert.equal(result.sent, 0);
    assert.ok([...repo.rows.values()].some(row => row.kind === "approval_reminder" && row.status === "cancelled"));
  }
});

test("email digest is once per KL calendar day and never duplicates on repeated runs", async () => {
  const repo = repository();
  repo.workspaceRows[0]!.data.ingredients[0]!.expiry = "2026-10-25";
  let time = new Date("2026-10-22T15:00:00Z");
  const options = { dryRun: false, routes: [testRoute], clock: () => time, pause, sender: accepted };
  assert.equal((await runEmailWorker(repo, options)).sent, 2);
  assert.equal((await runEmailWorker(repo, options)).sent, 0);
  time = new Date("2026-10-22T16:00:00Z");
  assert.equal((await runEmailWorker(repo, options)).sent, 1);
  assert.equal([...repo.rows.values()].filter(row => row.kind === "daily_digest" && row.status === "accepted").length, 2);
});

test("email worker refuses overlap, atomically reserves attempts, and does not retry uncertain or rejected sends", async () => {
  const repo = repository();
  repo.locked = true;
  assert.equal((await runEmailWorker(repo, { dryRun: false, routes: [testRoute], clock, pause, sender: accepted })).overlapSkipped, true);
  repo.locked = false;
  const candidate = scanEmailCandidates(repo.workspaceRows[0]!.data, now).candidates[0]!;
  const row = emailRecord(candidate, testRoute.workspaceId, testRoute.recipientHash, now);
  await repo.enqueue(row);
  assert.equal(await repo.startAttempt(row.id, row.message, now.toISOString()), true);
  assert.equal(await repo.startAttempt(row.id, row.message, now.toISOString()), false);
  let calls = 0;
  const options = { dryRun: false, routes: [testRoute], clock, pause,
    sender: (async () => { calls++; return { status: "failed", errorCode: "provider_http_403", errorDetail: "Rejected" }; }) as EmailSender };
  const first = await runEmailWorker(repo, options);
  assert.equal(first.uncertain, 1);
  assert.equal(first.failed, 1);
  assert.equal((await runEmailWorker(repo, options)).sent, 0);
  assert.equal(calls, 1);
  assert.equal(repo.rows.get(row.id)!.status, "uncertain");
});

test("email recipient changes cannot send an old queued message to the former address; owners are isolated", async () => {
  const repo = repository();
  await runEmailWorker(repo, { dryRun: false, routes: [testRoute], clock, pause, sender: accepted });
  const changed = { ...testRoute, recipient: "new@example.invalid", recipientHash: "new-hash" };
  const recipients: string[] = [];
  await runEmailWorker(repo, { dryRun: false, routes: [changed], clock, pause,
    sender: async (id, to, message) => { recipients.push(to); return accepted(id, to, message); } });
  assert.ok(recipients.every(to => to === changed.recipient));
  assert.ok([...repo.rows.values()].some(row => row.recipientHash === testRoute.recipientHash && row.status === "cancelled"));
  const other = await runEmailWorker(repo, { dryRun: false, routes: [{ ...testRoute, workspaceId: "owner:missing" }], clock, pause, sender: accepted });
  assert.equal(other.sent, 0); assert.equal(other.failed, 1);
});

test("email acceptance followed by a database failure stays reserved and is never blindly resent", async () => {
  const repo = repository();
  const finish = repo.finishAttempt.bind(repo);
  const logs: { event: string; fields: Record<string, unknown> }[] = [];
  let calls = 0;
  const options = { dryRun: false, routes: [testRoute], clock, pause,
    log: (event: string, fields: Record<string, unknown>) => { logs.push({ event, fields }); },
    sender: (async id => { calls++; return { status: "accepted", providerId: `mock-${id}` }; }) as EmailSender };
  repo.finishAttempt = async () => { throw new Error("simulated database failure"); };
  await assert.rejects(() => runEmailWorker(repo, options));
  assert.equal(calls, 1);
  const reserved = [...repo.rows.values()].find(row => row.status === "sending")!;
  assert.ok(reserved);
  assert.ok(logs.some(row => row.event === "email_worker_aborted" && row.fields.attemptsReserved === 1));
  repo.finishAttempt = finish;
  await runEmailWorker(repo, options);
  assert.equal(repo.rows.get(reserved.id)!.status, "uncertain");
  assert.equal(calls, 2);
  await runEmailWorker(repo, options);
  assert.equal(calls, 2);
});

test("email derived approval identifiers survive daily regeneration without mutating planning", () => {
  const state = seed(), before = structuredClone(state);
  const first = scanEmailCandidates(state, now).candidates.filter(row => row.eventKey.startsWith("review:"));
  const next = scanEmailCandidates(state, new Date(now.getTime() + 24 * 3600_000)).candidates.filter(row => row.eventKey.startsWith("review:"));
  assert.ok(first.length > 0);
  // Unchanged numeric proposals retain a key; changed proposals are deliberately new events.
  for (const row of first) {
    const sameSubject = next.find(other => other.message.subject === row.message.subject);
    if (sameSubject && sameSubject.message.text === row.message.text) assert.equal(row.eventKey, sameSubject.eventKey);
  }
  assert.deepEqual(state, before);
});

test("email sender uses fixed HTTPS and provider idempotency; receipts are acceptance, not delivery", async () => {
  let calls = 0;
  const sender = resendSender({ apiKey: "test-secret", from: "alerts@example.invalid" }, async (url, init) => {
    calls++; assert.equal(url, "https://api.resend.com/emails");
    assert.equal((init!.headers as Record<string, string>)["Idempotency-Key"], "expiryguard-email/test-id");
    return new Response(JSON.stringify({ id: "provider-test-id" }), { status: 200 });
  });
  assert.deepEqual(await sender("test-id", testRoute.recipient, { subject: "test", text: "test" }), { status: "accepted", providerId: "provider-test-id" });
  assert.equal(calls, 1);
  for (const code of [400, 401, 403, 429, 500, 503]) {
    const result = await resendSender({ apiKey: "test-secret", from: "alerts@example.invalid" },
      async () => new Response("private-provider-error", { status: code }))("id", testRoute.recipient, { subject: "test", text: "test" });
    assert.equal(result.status, code >= 500 ? "uncertain" : "failed");
    assert.ok(!JSON.stringify(result).includes("private-provider-error"));
    assert.ok(!JSON.stringify(result).includes("test-secret"));
  }
  const timeout = await resendSender({ apiKey: "test", from: "alerts@example.invalid" }, async () => { throw new Error("private-secret"); })("id", testRoute.recipient, { subject: "", text: "" });
  assert.equal(timeout.status, "uncertain");
  assert.ok(!JSON.stringify(timeout).includes("private-secret"));
});

test("email live mode requires explicit enablement and valid owner-only routing", () => {
  assert.throws(() => providerConfig({}), /email_sending_disabled/);
  assert.throws(() => providerConfig({ EMAIL_NOTIFICATIONS_ENABLED: "true" }), /not_configured/);
  assert.throws(() => emailRoutes({ EMAIL_WORKSPACE_RECIPIENTS_JSON: '{"demo":"owner@example.invalid"}' }), /invalid_recipient/);
  assert.throws(() => emailRoutes({ EMAIL_WORKSPACE_RECIPIENTS_JSON: '{"owner:user_test":"bad\\r\\naddress"}' }), /invalid_recipient/);
  assert.deepEqual(emailRoutes({}), []);
  assert.equal(emailRoutes({ EMAIL_WORKSPACE_RECIPIENTS_JSON: '{"owner:user_test":"owner@example.invalid"}' }).length, 1);
});
