import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Server } from "node:http";
import guardRouter from "../routes/guard";
import reorderRouter from "../routes/guard-reorders";
import { resetWorkspace, snapshotWorkspace } from "./guard-http-fixture";
import { seed, shift, today, compute } from "./guard-model";
import type { Reorders } from "./guard-reorder";

let server: Server, base: string;
before(async () => {
  const app = express();
  app.use(express.json(), guardRouter, reorderRouter);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}`;
});
after(() => new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())));

async function request(path: string, body?: unknown, method = "POST") {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}
function fixture() {
  const s = seed();
  s.ingredients = [s.ingredients.find(i => i.id === "tomato")!];
  Object.assign(s.ingredients[0]!, {
    quantity: 1, expiry: shift(today(), 1),
    deliveryQuantity: 4, deliveryDate: shift(today(), 2),
  });
  s.automation = { dailyPlanning: false, followUpHandling: false, runs: [] };
  s.reordering = { settings: [{
    ingredientId: "tomato", leadDays: 2, reviewDays: 2,
    minOrder: 1, safetyStock: 0, shelfDays: 5, dailyUsage: 2,
  }], plans: [] };
  resetWorkspace(s);
  return s;
}
async function scan() {
  const response = await request("/guard/reorders/scan", {});
  assert.equal(response.status, 200);
  return (response.data as Reorders).plans.find(p => p.status === "PENDING_APPROVAL")!;
}
const endpoint = (id: string) => `/guard/reorders/${id}/decision`;

test("HTTP: imported inventory feeds analysis; approval alone executes and persists one audited delivery update", async () => {
  fixture();
  const initial = snapshotWorkspace().ingredients[0]!;
  const input = { ...initial, quantity: 2, deliveryQuantity: 6 };
  assert.equal((await request("/guard/records", { kind: "inventory", rows: [input] })).status, 200);
  const p = await scan();
  assert.equal(p.line.currentStock, 2);
  assert.equal(p.line.incomingQuantity, 6);
  assert.equal(p.line.recommendedQuantity, 4);
  assert.match(p.line.explanation, /Reduce planned purchasing/);
  assert.equal(snapshotWorkspace().ingredients[0]!.deliveryQuantity, 6, "scan is read-only for orders");
  const approval = { decision: "approve", approver: "HTTP test owner", quantity: 3, deliveryDate: p.line.deliveryDate };
  const responses = await Promise.all([request(endpoint(p.id), approval), request(endpoint(p.id), approval)]);
  assert.deepEqual(responses.map(r => r.status), [200, 200]);
  const state = snapshotWorkspace(), completed = state.reordering!.plans.find(x => x.id === p.id)!;
  assert.equal(completed.status, "EXECUTED");
  assert.equal(completed.beforeQuantity, 6);
  assert.equal(completed.afterQuantity, 3);
  assert.equal(completed.approver, approval.approver);
  assert.ok(completed.decidedAt && Number.isFinite(Date.parse(completed.decidedAt)));
  assert.equal(state.ingredients[0]!.quantity, 2, "purchase planning never receives/consumes stock");
  assert.equal(state.ingredients[0]!.deliveryQuantity, 3);
  const entries = state.activity.filter(a => a.detail.includes(`Proposal ${p.id}.`));
  assert.equal(entries.length, 1, "concurrent replay produces exactly one execution log");
  assert.equal(entries[0]!.time, completed.decidedAt);
  assert.equal(entries[0]!.decision, "executed");
  assert.match(entries[0]!.detail, /6 → 3 kg/);
  assert.match(entries[0]!.detail, /delivery date:/);
  const reloaded = await request("/guard/reorders");
  assert.equal((reloaded.data as Reorders).plans.find(x => x.id === p.id)!.afterQuantity, 3);
  const beforeReplay = JSON.stringify(snapshotWorkspace());
  await request(endpoint(p.id), { ...approval, quantity: 9 });
  assert.equal(JSON.stringify(snapshotWorkspace()), beforeReplay, "altered replay cannot execute again");
});

test("HTTP: rejected proposal is immutable, audited with unchanged values, and cannot later execute", async () => {
  fixture(); const p = await scan(), before = snapshotWorkspace().ingredients;
  assert.equal((await request(endpoint(p.id), { decision: "reject", approver: "HTTP test owner" })).status, 200);
  const saved = snapshotWorkspace();
  assert.equal(saved.reordering!.plans[0]!.status, "REJECTED");
  assert.match(saved.activity[0]!.detail, /4 → 4 kg/);
  await request(endpoint(p.id), { decision: "approve", approver: "HTTP test owner", quantity: 9 });
  assert.deepEqual(snapshotWorkspace(), saved);
  assert.deepEqual(snapshotWorkspace().ingredients, before);
});

test("HTTP: malformed approval is rejected; below-minimum or stale approval records failure without changing orders", async () => {
  fixture(); let p = await scan();
  const before = snapshotWorkspace().ingredients;
  assert.equal((await request(endpoint(p.id), { decision: "approve", approver: "" })).status, 400);
  assert.equal(snapshotWorkspace().reordering!.plans[0]!.status, "PENDING_APPROVAL");
  await request(endpoint(p.id), { decision: "approve", approver: "HTTP test owner", quantity: 0.5 });
  assert.equal(snapshotWorkspace().reordering!.plans[0]!.status, "FAILED");
  assert.deepEqual(snapshotWorkspace().ingredients, before);
  assert.match(snapshotWorkspace().activity[0]!.detail, /4 → 4 kg/);
  p = await scan();
  await request("/guard/reorders/settings", { ...p.line.config, dailyUsage: 3 }, "PATCH");
  await request(endpoint(p.id), { decision: "approve", approver: "HTTP test owner" });
  assert.equal(snapshotWorkspace().reordering!.plans.find(x => x.id === p.id)!.status, "SUPERSEDED");
  assert.deepEqual(snapshotWorkspace().ingredients, before);
});

test("HTTP: legacy purchase rejection cannot restore an old quantity or be reapproved", async () => {
  const s = fixture();
  const rec = compute(s).recommendations.find(r => r.type === "purchase")!;
  const url = `/guard/recommendations/${encodeURIComponent(rec.id)}/decision`;
  assert.equal((await request(url, { decision: "edited", quantity: 2 })).status, 200);
  assert.equal(snapshotWorkspace().ingredients[0]!.deliveryQuantity, 2);
  assert.equal((await request(url, { decision: "rejected" })).status, 200);
  assert.equal(snapshotWorkspace().ingredients[0]!.deliveryQuantity, 2, "rejection must not restore original 4 kg");
  const saved = JSON.stringify(snapshotWorkspace());
  await request(url, { decision: "approved", quantity: 8 });
  assert.equal(JSON.stringify(snapshotWorkspace()), saved, "rejected purchase is terminal");
});
