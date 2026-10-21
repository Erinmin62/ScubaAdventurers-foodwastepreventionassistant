import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { seed, shift, today } from "./guard-model";
import { defaultNotificationSettings, notificationState, readNotificationReview, saveNotificationSettings, scanNotificationEvents } from "./guard-notifications";
import { notificationEvents } from "./guard-notification-events";
import { sendApprovedWhatsAppTemplate, verifyWhatsAppSignature } from "./whatsapp-cloud";
import { MONITOR_STALE_AFTER_MS, monitorHeartbeatState, recordMonitorHeartbeat } from "./monitor-heartbeat";

const now = () => `${today()}T02:00:00.000Z`;
const later = (hours: number) => new Date(Date.parse(now()) + hours * 3_600_000).toISOString();
function fixture() {
  const s = seed();
  s.ingredients = s.ingredients.filter(i => i.id === "tomato");
  s.ingredients[0]!.expiry = shift(today(), 1);
  s.activity = [];
  saveNotificationSettings(s, { ...defaultNotificationSettings(), enabled: true, phone: "+60123456789", optIn: true, recommendations: false, approvals: false }, now());
  return s;
}
test("monitor heartbeat distinguishes unstarted, healthy, stale, and failed checks without changing stock", () => {
  const s = seed();
  const ingredients = structuredClone(s.ingredients);
  const checkedAt = "2026-10-21T12:00:00.000Z";
  const checkedTime = Date.parse(checkedAt);

  assert.equal(monitorHeartbeatState(s.monitorHeartbeat, checkedTime).status, "not-started");
  recordMonitorHeartbeat(s, "success", checkedAt);
  assert.equal(monitorHeartbeatState(s.monitorHeartbeat, checkedTime).status, "healthy");
  assert.equal(monitorHeartbeatState(s.monitorHeartbeat, checkedTime + MONITOR_STALE_AFTER_MS + 1).status, "stale");

  recordMonitorHeartbeat(s, "failure", new Date(checkedTime + 1000).toISOString());
  const failed = monitorHeartbeatState(s.monitorHeartbeat, checkedTime + 1000);
  assert.equal(failed.status, "failed");
  assert.equal(failed.lastSuccessfulAt?.toISOString(), checkedAt);

  recordMonitorHeartbeat(s, "success", new Date(checkedTime + 2000).toISOString());
  assert.equal(monitorHeartbeatState(s.monitorHeartbeat, checkedTime + 2000).status, "healthy");
  assert.equal(monitorHeartbeatState(s.monitorHeartbeat, checkedTime + 2000).lastSuccessfulAt?.toISOString(), new Date(checkedTime + 2000).toISOString());
  assert.deepEqual(s.ingredients, ingredients);
});
test("disabled defaults never invent sent messages or change plans", () => {
  const s = seed(), before = structuredClone(s.ingredients);
  scanNotificationEvents(s, now(), true);
  assert.equal(notificationState(s).mode, "demo");
  assert.equal(notificationState(s).liveReady, false);
  assert.equal(s.notifications!.records.length, 0);
  assert.deepEqual(s.ingredients, before);
  assert.deepEqual(s.decisions, {});
});
test("expiry thresholds include expired/today/3/7 days, exclude zero stock and >7; expired guidance is disposal only", () => {
  const s = fixture(), i = s.ingredients[0]!;
  for (const [days, expected] of [[-1, "critical"], [0, "critical"], [3, "warning"], [7, "upcoming"]] as const) {
    i.expiry = shift(today(), days);
    const e = notificationEvents(s).find(e => e.kind === "expiry")!;
    assert.equal(e.priority, expected);
    assert.match(e.text, /Estimated/);
    if (days < 0) {
      assert.match(e.text, /Do not consume, prepare or sell/);
      assert.ok(!e.text.includes("Prioritise"));
    }
  }
  i.expiry = shift(today(), 8);
  assert.equal(notificationEvents(s).filter(e => e.kind === "expiry").length, 0);
  i.expiry = today(); i.quantity = 0;
  assert.equal(notificationEvents(s).filter(e => e.kind === "expiry").length, 0);
});
test("new event creates demo preview; repeat scans obey reminder interval, lifetime cap and global day budget", () => {
  const s = fixture(), before = structuredClone(s.ingredients);
  scanNotificationEvents(s, now(), true);
  assert.equal(s.notifications!.records.length, 1);
  assert.match(s.notifications!.records[0]!.message, /DEMO — NOT SENT/);
  scanNotificationEvents(s, later(1), true);
  assert.equal(s.notifications!.records.length, 1);
  scanNotificationEvents(s, later(24), true);
  scanNotificationEvents(s, later(48), true);
  scanNotificationEvents(s, later(72), true);
  assert.equal(s.notifications!.records.length, 3, "initial plus two reminders only");
  assert.deepEqual(s.ingredients, before);
  assert.ok(s.notifications!.records.every(r => r.attempts === 0 && r.status === "demo"));
});
test("daily cap defers events without marking them sent, manual scans cannot bypass it", () => {
  const s = fixture();
  s.notifications!.settings.dailyLimit = 1;
  s.notifications!.settings.approvals = true;
  scanNotificationEvents(s, now(), true);
  scanNotificationEvents(s, later(2), true);
  assert.equal(s.notifications!.records.length, 1);
  assert.equal(Object.keys(s.notifications!.events).length, 1);
  scanNotificationEvents(s, later(24), true);
  assert.equal(s.notifications!.records.length, 2);
});
test("resolution, consent revoke, recipient change and preference switches stop obsolete reminders and links", () => {
  const s = fixture();
  scanNotificationEvents(s, now(), true);
  const record = s.notifications!.records[0]!;
  const token = record.reviewUrl.split("#token=")[1]!;
  assert.ok(readNotificationReview(s, token, now()));
  s.ingredients[0]!.quantity = 0;
  assert.equal(readNotificationReview(s, token, now()), null, "immediate current-data check");
  scanNotificationEvents(s, later(24), true);
  assert.ok(record.resolvedAt);
  assert.equal(s.notifications!.records.length, 1);
  const settings = s.notifications!.settings;
  saveNotificationSettings(s, { ...settings, optIn: false, enabled: false }, later(25));
  assert.equal(s.notifications!.consentAt, null);
  scanNotificationEvents(s, later(48), true);
  assert.equal(s.notifications!.records.length, 1);
  assert.equal(readNotificationReview(s, token, later(25)), null);
});
test("review tokens are random, bounded, hashed in storage and read-only; public response hides hashes", () => {
  const s = fixture();
  scanNotificationEvents(s, now(), true);
  const r = s.notifications!.records[0]!, token = r.reviewUrl.split("#token=")[1]!;
  assert.notEqual(r.tokenHash, token);
  assert.ok(!JSON.stringify(notificationState(s)).includes("tokenHash"));
  const before = JSON.stringify(s);
  assert.ok(readNotificationReview(s, token, now()));
  assert.equal(JSON.stringify(s), before);
  assert.equal(readNotificationReview(s, token, later(49)), null);
  assert.equal(readNotificationReview(s, "x".repeat(43), now()), null);
});
test("failure and completion messages refer to actual records and never replay pre-consent outcomes", () => {
  const s = fixture(), line = {
    ingredientId: "tomato", name: "Cherry tomatoes",
  } as NonNullable<typeof s.reordering>["plans"][number]["line"];
  s.notifications!.settings.failures = true; s.notifications!.settings.completed = true;
  s.notifications!.settings.expiry = false;
  s.reordering = { settings: [], plans: [
    { id: "failed", status: "FAILED", createdAt: now(), decidedAt: later(1), approver: "Test", fingerprint: "", line, detail: "Not executed: minimum order rejected." },
    { id: "done", status: "EXECUTED", createdAt: now(), decidedAt: later(1), approver: "Test", fingerprint: "", line, detail: "Simulated order updated. Stock unchanged." },
    { id: "old", status: "EXECUTED", createdAt: now(), decidedAt: later(-24), approver: "Test", fingerprint: "", line, detail: "Old result." },
  ] };
  scanNotificationEvents(s, later(2), true);
  assert.equal(s.notifications!.records.length, 2);
  assert.deepEqual(new Set(s.notifications!.records.map(r => r.kind)), new Set(["failures", "completed"]));
  assert.ok(!s.notifications!.records.some(r => r.eventId === "completed:old"));
});

const config = { accessToken: "test-not-a-real-token", phoneNumberId: "1234", graphVersion: "v99.0", templateName: "test_template", language: "en_US" };
const input = { phone: "+60123456789", optedIn: true, title: "Test alert", detail: "Synthetic inventory", reviewUrl: "https://example.com/notification-review#token=" + "x".repeat(43) };
test("Cloud adapter sends approved-template format only and treats acceptance separately from delivery", async () => {
  let calls = 0;
  const result = await sendApprovedWhatsAppTemplate(config, input, (async (url, options) => {
    calls++;
    assert.match(String(url), /^https:\/\/graph.facebook.com\//);
    const body = JSON.parse(options!.body as string);
    assert.equal(body.type, "template"); assert.equal(body.to, "60123456789");
    assert.equal(body.template.components[0].parameters.length, 3);
    return new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), { status: 200 });
  }) as typeof fetch);
  assert.equal(calls, 1); assert.equal(result.status, "accepted");
  assert.equal(result.providerMessageId, "wamid.test");
});
test("Cloud errors never expose credentials; expired permissions stop retries, rate limit is retryable, ambiguous timeout isn't", async () => {
  for (const status of [401, 403, 429, 500]) {
    const r = await sendApprovedWhatsAppTemplate(config, input, (async () => new Response("secret provider payload", { status })) as typeof fetch);
    assert.equal(r.status, "failed");
    assert.equal(r.retryable, status === 429 || status === 500);
    assert.ok(!JSON.stringify(r).includes(config.accessToken));
    assert.ok(!JSON.stringify(r).includes("secret provider payload"));
  }
  const timeout = await sendApprovedWhatsAppTemplate(config, input, (async () => { throw new Error("timeout"); }) as typeof fetch);
  assert.equal(timeout.status, "unknown"); assert.equal(timeout.retryable, false);
});
test("Cloud adapter refuses missing opt-in, insecure links and incomplete config without making any request", async () => {
  let calls = 0;
  const http = (async () => { calls++; throw new Error("must not call"); }) as typeof fetch;
  assert.equal((await sendApprovedWhatsAppTemplate(config, { ...input, optedIn: false }, http)).status, "failed");
  assert.equal((await sendApprovedWhatsAppTemplate(config, { ...input, reviewUrl: "http://example.com" }, http)).status, "failed");
  assert.equal((await sendApprovedWhatsAppTemplate({ ...config, accessToken: "" }, input, http)).status, "failed");
  assert.equal(calls, 0);
});
test("webhook HMAC requires matching raw bytes and secret", () => {
  const raw = Buffer.from('{"test":true}'), secret = "test-only-secret";
  const signature = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  assert.equal(verifyWhatsAppSignature(raw, signature, secret), true);
  assert.equal(verifyWhatsAppSignature(Buffer.from("{}"), signature, secret), false);
  assert.equal(verifyWhatsAppSignature(raw, signature, ""), false);
});
