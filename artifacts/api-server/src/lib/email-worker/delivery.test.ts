import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { Webhook } from "svix";
import { createDeliveryWebhook, deliveryTypes, type DeliveryEvent } from "./delivery";
import { createOwnerAuth } from "../../middlewares/owner-auth";
import { currentWorkspaceId } from "../workspace-context";

// Synthetic signing key; never calls Resend.
const secret = `whsec_${Buffer.from("synthetic-delivery-test-key-only").toString("base64")}`;
const signer = new Webhook(secret);
const body = (type = "email.delivered") => JSON.stringify({
  type, created_at: "2026-10-22T10:00:00Z",
  data: { email_id: "mock-provider-id", to: ["private@example.invalid"], subject: "Do not retain", tags: { workspaceId: "owner:attacker" } },
});

test("raw signed Resend requests verify; invalid, changed, stale and malformed requests cannot write", async () => {
  const events: DeliveryEvent[] = [];
  let enabled = true, configured: string | undefined = secret, fail = false;
  const app = express();
  app.post("/api/webhooks/resend", express.raw({ type: "application/json" }), createDeliveryWebhook(async event => {
    if (fail) throw new Error("private database error");
    events.push(event);
  }, () => ({ enabled, secret: configured })));
  const server = app.listen(0);
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/api/webhooks/resend`;
  async function post(payload: string, overrides: Record<string, string> = {}, signedPayload = payload, date = new Date()) {
    const id = "msg_synthetic";
    return fetch(url, { method: "POST", headers: {
      "content-type": "application/json", "svix-id": id,
      "svix-timestamp": `${Math.floor(date.getTime() / 1000)}`,
      "svix-signature": signer.sign(id, date, signedPayload), ...overrides,
    }, body: payload });
  }
  try {
    assert.equal((await post(body())).status, 200);
    assert.deepEqual(events, [{
      id: "msg_synthetic", providerMessageId: "mock-provider-id",
      type: "email.delivered", occurredAt: "2026-10-22T10:00:00Z",
    }]);
    for (const type of deliveryTypes) assert.equal((await post(body(type))).status, 200);
    const count = events.length;
    assert.equal((await post(body(), { "svix-signature": "v1,invalid" })).status, 400);
    assert.equal((await post(body(), { "svix-id": "" })).status, 400);
    assert.equal((await post(body() + " ", {}, body())).status, 400);
    assert.equal((await post(body(), {}, body(), new Date(Date.now() - 600_000))).status, 400);
    assert.equal((await post(body(), {}, body(), new Date(Date.now() + 600_000))).status, 400);
    assert.equal((await post('{"type":"email.delivered","data":{}}')).status, 400);
    assert.equal((await post('{"type":"email.bounced","created_at":"bad-date","data":{"email_id":"id"}}')).status, 400);
    assert.equal((await post("not json")).status, 400);
    assert.equal((await post(body("email.opened"))).status, 200);
    assert.equal(events.length, count);
    fail = true;
    const unavailable = await post(body());
    assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.text()).includes("private database"), false);
    fail = false; enabled = false;
    assert.equal((await post(body())).status, 503);
    enabled = true; configured = undefined;
    assert.equal((await post(body())).status, 503);
    assert.equal(events.length, count);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("email history requires identity and ignores caller-selected workspace", async () => {
  const app = express();
  // Inject an identity resolver only in the isolated test app, never in production.
  app.use("/api/guard", createOwnerAuth(req => req.get("x-test-user") ?? null));
  app.get("/api/guard/email-history", (_req, res) => res.json({ workspace: currentWorkspaceId() }));
  const server = app.listen(0);
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/api/guard/email-history?workspaceId=owner:other`;
  try {
    assert.equal((await fetch(url)).status, 401);
    const response = await fetch(url, { headers: { "x-test-user": "alice", "x-workspace-id": "owner:other" } });
    assert.deepEqual(await response.json(), { workspace: "owner:alice" });
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal((await fetch(url, { headers: { "x-test-user": "bob", "sec-fetch-site": "cross-site" } })).status, 403);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
