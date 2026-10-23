import { test } from "node:test";
import assert from "node:assert/strict";
import { seed } from "./guard-model";
import { notificationsFor } from "./guard-notifications";
import { runTwilioSandbox } from "./guard-sandbox";
import {
  sandboxConfig, publicSandboxState, sendSandboxMessage, newSandboxStore,
  type SandboxConfig,
} from "./twilio-sandbox";

// Fictitious credentials and recipient only; unit tests never contact Twilio.
const config = sandboxConfig({
  TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`,
  TWILIO_AUTH_TOKEN: "unit-test-token", TWILIO_SANDBOX_RECIPIENT: "+19999999999",
})!;
const now = "2026-10-21T06:00:00.000Z";
const minute = (n: number) => new Date(Date.parse(now) + n * 60_000).toISOString();
const sid = (n: number) => `SM${String(n).padStart(32, "0")}`;
function inbound(body = "START EXPIRYGUARDAI DEMO", at = minute(-1), n = 1) {
  return { sid: sid(n), direction: "inbound", from: `whatsapp:${config.recipient}`, to: `whatsapp:${config.sender}`, body, date_sent: at };
}
function fixture() {
  const s = seed();
  const n = notificationsFor(s);
  n.settings.enabled = false;
  n.settings.phone = "+18888888888"; // Public preference must never become a real recipient.
  const posts: URLSearchParams[] = [];
  const requests: { url: string; init?: RequestInit }[] = [];
  let messages: unknown[] = [inbound()];
  let sendStatus = 201, sendBody: object = { sid: sid(100), status: "queued" };
  let readStatus = 200, delivery = "delivered", throws = false;
  const http: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    if (init?.method === "POST") {
      posts.push(new URLSearchParams(String(init.body)));
      if (throws) throw new Error("A sensitive raw network exception must not escape");
      return Response.json(sendBody, { status: sendStatus });
    }
    if (url.includes(`/Messages/${sid(100)}.json`))
      return Response.json({ sid: sid(100), status: delivery, to: `whatsapp:${config.recipient}`, from: `whatsapp:${config.sender}` });
    return Response.json(readStatus === 200 ? { messages } : { code: 20003, message: "sensitive provider payload" }, { status: readStatus });
  };
  const mutate = async (action: (state: typeof s) => void) => { action(s); };
  const run = (time = now, c: SandboxConfig | null = config) => runTwilioSandbox({ mutate, config: c, http, now: time });
  return {
    s, posts, requests, run,
    setMessages: (v: unknown[]) => { messages = v; },
    setReadStatus: (v: number) => { readStatus = v; },
    setSend: (status: number, body: object) => { sendStatus = status; sendBody = body; },
    throwOnSend: () => { throws = true; },
    setDelivery: (v: string) => { delivery = v; },
  };
}
test("missing/invalid server configuration makes no network request", async () => {
  assert.equal(sandboxConfig({}), null);
  assert.equal(sandboxConfig({ TWILIO_ACCOUNT_SID: config.accountSid, TWILIO_AUTH_TOKEN: "x", TWILIO_SANDBOX_RECIPIENT: "not-a-phone" }), null);
  const f = fixture(); await f.run(now, null);
  assert.equal(f.requests.length, 0);
});
test("joining or saying hello alone cannot opt a recipient in", async () => {
  for (const text of ["join demo-code", "hello", ""]) {
    const f = fixture(); f.setMessages([inbound(text)]); await f.run();
    assert.equal(f.posts.length, 0);
    assert.equal(f.s.notifications!.sandbox!.status, "waiting-for-opt-in");
  }
});
test("only the configured inbound sender with a fresh explicit command can authorize", async () => {
  for (const m of [
    { ...inbound(), from: "whatsapp:+18888888888" },
    { ...inbound(), to: "whatsapp:+17777777777" },
    { ...inbound(), direction: "outbound-api" },
    inbound("START EXPIRYGUARDAI DEMO", minute(-1441)),
    inbound("START EXPIRYGUARDAI DEMO", minute(10)),
  ]) {
    const f = fixture(); f.setMessages([m]); await f.run(); assert.equal(f.posts.length, 0);
  }
});
test("verified consent sends form-encoded content to the secret recipient only and preserves application actions", async () => {
  const f = fixture();
  const before = JSON.stringify({ ingredients: f.s.ingredients, decisions: f.s.decisions, reordering: f.s.reordering, followUps: f.s.followUps });
  await f.run();
  assert.equal(f.posts.length, 1);
  assert.equal(f.posts[0]!.get("To"), `whatsapp:${config.recipient}`);
  assert.equal(f.posts[0]!.get("From"), `whatsapp:${config.sender}`);
  assert.match(f.posts[0]!.get("Body")!, /SANDBOX TEST/);
  assert.match(f.posts[0]!.get("Body")!, /estimates, not realised savings/);
  assert.ok(f.posts[0]!.get("Body")!.length <= 1600);
  assert.equal(new Headers(f.requests.find(r => r.init?.method === "POST")!.init!.headers).get("Content-Type"), "application/x-www-form-urlencoded");
  assert.equal(f.s.notifications!.sandbox!.attempts[0]!.status, "accepted");
  assert.equal(JSON.stringify({ ingredients: f.s.ingredients, decisions: f.s.decisions, reordering: f.s.reordering, followUps: f.s.followUps }), before);
});
test("repeat and concurrent checks do not submit the same digest twice", async () => {
  const f = fixture();
  await Promise.all([f.run(), f.run()]);
  await f.run(minute(1)); await f.run(minute(6));
  assert.equal(f.posts.length, 1);
});
test("recipient pause blocks sending; a fresh START permits an explicitly requested new test", async () => {
  const f = fixture(); await f.run();
  f.setMessages([inbound("PAUSE EXPIRYGUARDAI DEMO", minute(1), 2), inbound()]);
  await f.run(minute(2));
  assert.equal(f.s.notifications!.sandbox!.status, "paused");
  assert.equal(f.posts.length, 1);
  f.setMessages([inbound("START EXPIRYGUARDAI DEMO", minute(6), 3)]);
  await f.run(minute(7));
  assert.equal(f.posts.length, 2);
});
test("24h window closure prevents free-form sends until the recipient messages again", async () => {
  const f = fixture(); await f.run();
  await f.run(minute(1441));
  assert.equal(f.s.notifications!.sandbox!.status, "window-closed");
  assert.equal(f.posts.length, 1);
  f.setMessages([inbound("hello", minute(1442), 2)]);
  await f.run(minute(1443));
  assert.equal(f.posts.length, 2);
});
test("three attempts per rolling day is a hard cap, not controlled by demo preferences", async () => {
  const f = fixture();
  f.s.notifications!.settings.dailyLimit = 20;
  for (const n of [1, 2, 3, 4]) {
    f.setMessages([inbound("START EXPIRYGUARDAI DEMO", minute(n * 6 - 1), n)]);
    await f.run(minute(n * 6));
  }
  assert.equal(f.posts.length, 3);
  assert.equal(f.s.notifications!.sandbox!.status, "daily-limit");
});
test("a failed request is recorded without raw errors and is not resubmitted", async () => {
  const f = fixture(); f.setSend(400, { code: 63015, message: "sensitive provider payload" });
  await f.run(); await f.run(minute(10));
  assert.equal(f.posts.length, 1);
  const a = f.s.notifications!.sandbox!.attempts[0]!;
  assert.equal(a.status, "failed");
  assert.match(a.lastError!, /63015/);
  assert.ok(!a.lastError!.includes("sensitive provider payload"));
});
test("uncertain send and persisted crash reservations are never automatically retried", async () => {
  const f = fixture(); f.throwOnSend(); await f.run(); await f.run(minute(10));
  assert.equal(f.posts.length, 1);
  assert.equal(f.s.notifications!.sandbox!.attempts[0]!.status, "unknown");
  assert.ok(!JSON.stringify(f.s.notifications!.sandbox).includes("sensitive raw network"));
  f.s.notifications!.sandbox!.attempts[0]!.status = "sending";
  await f.run(minute(20));
  assert.equal(f.posts.length, 1);
  assert.equal(f.s.notifications!.sandbox!.attempts[0]!.status, "unknown");
});
test("API acceptance is not delivery; verified later status updates it", async () => {
  const f = fixture(); await f.run();
  assert.equal(f.s.notifications!.sandbox!.attempts[0]!.status, "accepted");
  await f.run(minute(1));
  assert.equal(f.s.notifications!.sandbox!.attempts[0]!.status, "delivered");
  assert.ok(f.s.activity.some(a => a.title.includes("delivery: delivered")));
});
test("authentication failures fail closed and do not expose the provider payload", async () => {
  const f = fixture(); f.setReadStatus(401); await f.run();
  assert.equal(f.posts.length, 0);
  assert.equal(f.s.notifications!.sandbox!.status, "error");
  assert.ok(!f.s.notifications!.sandbox!.notice.includes("sensitive provider payload"));
});
test("public status strips secret identity and internal fingerprints", async () => {
  const f = fixture(); await f.run();
  const safe = JSON.stringify(publicSandboxState(f.s.notifications!.sandbox, config, now));
  for (const hidden of [config.accountSid, config.authToken, config.recipient, config.key, f.s.notifications!.sandbox!.attempts[0]!.fingerprint])
    assert.ok(!safe.includes(hidden));
  assert.equal(publicSandboxState(undefined, null).status, "not-configured");
});
test("HTTP 5xx and malformed successes remain uncertain, never falsely delivered", async () => {
  for (const [status, body] of [[503, {}], [201, {}]] as const) {
    const result = await sendSandboxMessage(config, "Synthetic test", async () => Response.json(body, { status }));
    assert.equal(result.status, "unknown");
  }
});
test("recipient configuration changes clear consent without resetting the hard attempt budget", async () => {
  const f = fixture(); await f.run();
  const other = { ...config, key: "new-config", recipient: "+17777777777" };
  await f.run(minute(10), other);
  assert.equal(f.s.notifications!.sandbox!.consentSid, undefined);
  assert.equal(f.posts.length, 1);
  assert.equal(f.s.notifications!.sandbox!.attempts.length, 1);
});
