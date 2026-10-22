import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Server } from "node:http";
import guardRouter from "../routes/guard";
import { createGuardMenuRouter } from "../routes/guard-menu";
import { createGuardAiForecastDemoRouter } from "../routes/guard-ai-forecast-demo";
import reorderRouter from "../routes/guard-reorders";
import notificationsRouter from "../routes/guard-notifications";
import inboxRouter from "../routes/guard-inbox";
import { createHmac } from "node:crypto";
import { defaultNotificationSettings } from "./guard-notifications";
import { GetInboxResponse, GetMonitorHeartbeatStatusResponse, GetNotificationsResponse, ReviewNotificationResponse, PreviewReorderResponse } from "@workspace/api-zod";
import { resetWorkspace, snapshotWorkspace } from "./guard-http-fixture";
import { seed, shift, today, compute, type State } from "./guard-model";
import type { Reorders } from "./guard-reorder";
import { createOwnerAuth } from "../middlewares/owner-auth";
import { currentWorkspaceId, inWorkspace, ownerWorkspaceId } from "./workspace-context";
import type { SyntheticForecastContext } from "./ai-forecast-demo";

let server: Server, base: string;
let latestAiContext: SyntheticForecastContext | null = null;
before(async () => {
  const app = express();
  app.use("/guard/notifications/webhook", express.raw({ type: "application/json" }));
  const menuRouter = createGuardMenuRouter(async (_name, _description, pantry) => ({
    recipe: [{ ingredientId: pantry[0]!.id, amount: 0.08 }],
    explanation: "A draft using one available pantry ingredient.",
  }));
  const aiForecastDemoRouter = createGuardAiForecastDemoRouter(async context => {
    latestAiContext = structuredClone(context);
    return syntheticAiForecast(context);
  });
  app.use(express.json(), guardRouter, aiForecastDemoRouter, menuRouter, reorderRouter, notificationsRouter, inboxRouter);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}`;
});
after(() => new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())));

async function request(path: string, body?: unknown, method?: string) {
  const response = await fetch(base + path, {
    method: method ?? (body === undefined ? "GET" : "POST"),
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
function syntheticAiForecast(context: SyntheticForecastContext) {
  return JSON.stringify({
    summary: "Synthetic test output only.",
    demandForecasts: context.menu.map(item => ({
      menuId: item.id,
      predictedPortionsByDay: [1, 2, 3, 4, 5, 6, 7],
      totalPredictedPortions: 28,
      explanation: "A stable sample trend.",
    })),
    wastePredictions: context.ingredients.map(item => ({
      ingredientId: item.id,
      estimatedAtRisk: 0,
      explanation: "No sample stock is projected at risk.",
    })),
    orderRecommendations: context.ingredients.map(item => ({
      ingredientId: item.id,
      suggestedOrderQuantity: 0,
      proposedDeliveryDate: context.horizonDates[0],
      explanation: "No sample order is suggested.",
    })),
  });
}
test("HTTP: AI forecast demo uses synthetic data, does not write workspace state, and limits runs", async () => {
  fixture();
  const archiveOnlyName = "archive-only test stock";
  const archived = await request("/guard/history/import", { rows: [
    { kind: "stock", date: shift(today(), -1), itemName: archiveOnlyName, quantity: 987, unit: "kg" },
  ] });
  assert.equal(archived.status, 200);
  const before = snapshotWorkspace();
  assert.equal((await request("/guard/ai-forecast/demo", { demoOnly: false })).status, 400);
  const first = await request("/guard/ai-forecast/demo", { demoOnly: true });
  assert.equal(first.status, 200);
  const demo = first.data as {
    mode: string;
    historyDays: number;
    demandForecasts: unknown[];
    wastePredictions: unknown[];
    orderRecommendations: unknown[];
  };
  assert.equal(demo.mode, "synthetic_demo");
  assert.equal(demo.historyDays, 28);
  assert.ok(demo.demandForecasts.length > 0);
  assert.ok(demo.wastePredictions.length > 1);
  assert.ok(demo.orderRecommendations.length > 1);
  assert.ok(latestAiContext);
  assert.equal(JSON.stringify(latestAiContext).includes(archiveOnlyName), false, "historical imports are not passed into the AI demo context");
  assert.equal((await request("/guard/ai-forecast/demo", { demoOnly: true })).status, 200);
  assert.equal((await request("/guard/ai-forecast/demo", { demoOnly: true })).status, 200);
  assert.equal((await request("/guard/ai-forecast/demo", { demoOnly: true })).status, 429);
  assert.deepEqual(snapshotWorkspace(), before);
});
test("HTTP: historical imports validate atomically and stay out of live stock, sales, results, and orders", async () => {
  const before = fixture();
  const menuId = before.menu[0]!.id;
  const historicalDate = shift(today(), -1);
  const rejected = await request("/guard/history/import", { rows: [
    { kind: "sales", date: historicalDate, menuId, quantity: 6, unit: "portions" },
    { kind: "stock", date: shift(today(), 1), itemName: "Cherry tomatoes", quantity: 2, unit: "kg" },
  ] });
  assert.equal(rejected.status, 400, "a future-dated row rejects the whole import");
  assert.deepEqual(snapshotWorkspace(), before, "invalid rows must not partially save");

  const imported = await request("/guard/history/import", { rows: [
    { kind: "sales", date: historicalDate, menuId, quantity: 6, unit: "portions" },
    { kind: "preparation", date: historicalDate, menuId, prepared: 11, sold: 8, leftover: 3, unit: "portions" },
    { kind: "stock", date: historicalDate, itemName: "Cherry tomatoes", quantity: 3.5, unit: "kg" },
  ] });
  assert.equal(imported.status, 200);
  const importedRecords = (imported.data as { records: { id: string; kind: string }[] }).records;
  assert.deepEqual(importedRecords.map(row => row.kind), ["sales", "preparation", "stock"]);
  const after = snapshotWorkspace();
  assert.deepEqual(after.ingredients, before.ingredients);
  assert.deepEqual(after.sales, before.sales);
  assert.deepEqual(after.results, before.results);
  assert.deepEqual(after.decisions, before.decisions);
  assert.deepEqual(after.reordering, before.reordering);
  assert.deepEqual(((await request("/guard/history", undefined, "GET")).data as { records: unknown[] }).records, importedRecords);
});
test("HTTP: confirmed removal targets one import, persists, and leaves every operational field unchanged", async () => {
  fixture();
  const payload = { fileName: "wrong-file.csv", rows: [
    { kind: "stock", date: shift(today(), -1), itemName: "Tomatoes", quantity: 3, unit: "kg" },
    { kind: "stock", date: shift(today(), -2), itemName: "Tomatoes", quantity: 4, unit: "kg" },
  ] };
  const first = (await request("/guard/history/import", payload)).data as {
    records: { batchId: string; importedAt: string; fileName: string }[];
    batches: { id: string; fileName: string; recordCount: number }[];
  };
  const second = (await request("/guard/history/import", payload)).data as typeof first;
  assert.equal(first.batches.length, 1);
  assert.equal(first.batches[0]!.fileName, payload.fileName);
  assert.equal(first.batches[0]!.recordCount, 2);
  assert.ok(first.records.every(row => row.batchId === first.batches[0]!.id && row.importedAt === first.records[0]!.importedAt));
  assert.notEqual(first.batches[0]!.id, second.batches[0]!.id, "same file imports remain distinct");
  const before = snapshotWorkspace();
  const path = `/guard/history/batches/${encodeURIComponent(first.batches[0]!.id)}`;
  for (const body of [undefined, {}, { confirmed: false }, { confirmed: "true" }]) {
    assert.equal((await request(path, body, "DELETE")).status, 400);
    assert.deepEqual(snapshotWorkspace(), before);
  }
  assert.equal((await request("/guard/history/batches/missing", { confirmed: true }, "DELETE")).status, 404);
  const removed = await request(path, { confirmed: true }, "DELETE");
  assert.equal(removed.status, 200);
  assert.deepEqual((removed.data as typeof first).batches, second.batches);
  assert.deepEqual((await request("/guard/history")).data, removed.data, "reload sees removal");
  const after = snapshotWorkspace();
  assert.deepEqual({ ...after, historicalRecords: undefined }, { ...before, historicalRecords: undefined }, "all non-archive fields unchanged");
  assert.equal((await request(path, { confirmed: true }, "DELETE")).status, 404);
});
test("HTTP: legacy timestamp batches can be reviewed and removed without inventing a file name", async () => {
  const stored = fixture();
  stored.historicalRecords = [
    { id: "old-1", kind: "stock", date: shift(today(), -1), importedAt: "2026-01-01T01:00:00.000Z", itemName: "Flour", quantity: 2, unit: "kg" },
    { id: "old-2", kind: "stock", date: shift(today(), -1), importedAt: "2026-01-02T01:00:00.000Z", itemName: "Flour", quantity: 3, unit: "kg" },
  ];
  resetWorkspace(stored);
  const archive = (await request("/guard/history")).data as { batches: { id: string; fileName: string }[] };
  assert.equal(archive.batches.length, 2);
  assert.match(archive.batches[0]!.fileName, /unavailable/);
  const result = await request(`/guard/history/batches/${encodeURIComponent(archive.batches[0]!.id)}`, { confirmed: true }, "DELETE");
  assert.equal(result.status, 200);
  assert.deepEqual(snapshotWorkspace().historicalRecords, [stored.historicalRecords[0]]);
});
test("HTTP: menu changes preserve history, update planning, and keep recipe drafts owner-inventory bounded", async () => {
  fixture();
  const ingredients = (await request("/guard/state")).data as { ingredients: { id: string }[] };
  const newBody = {
    name: "Tomato toast",
    description: "Toasted bread with cherry tomato.",
    price: 18,
    cost: 5,
    recipe: [{ ingredientId: "tomato", amount: 0.1 }],
  };
  assert.equal((await request("/guard/menu", { ...newBody, recipe: [{ ingredientId: "missing", amount: 0.1 }] })).status, 400);
  const created = await request("/guard/menu", newBody);
  assert.equal(created.status, 201);
  const createdState = created.data as { menu: { id: string; name: string; archivedAt: string | null }[]; forecasts: { menuId: string }[] };
  const id = createdState.menu.find(m => m.name === "Tomato toast")!.id;
  assert.ok(createdState.forecasts.some(f => f.menuId === id));

  const drafted = await request("/guard/menu/recipe-draft", { name: "Tomato toast", description: "A simple café toast." });
  assert.equal(drafted.status, 200);
  assert.deepEqual((drafted.data as { recipe: { ingredientId: string; amount: number }[] }).recipe, [{ ingredientId: ingredients.ingredients[0]!.id, amount: 0.08 }]);

  assert.equal((await request("/guard/records", { kind: "sales", rows: [{ date: today(), menuId: id, portions: 7 }] })).status, 200);
  const updated = await request(`/guard/menu/${id}`, { name: "Tomato toast special", price: 19, cost: 6 }, "PATCH");
  assert.equal(updated.status, 200);
  const updatedState = updated.data as {
    menu: { id: string; name: string }[];
    sales: { menuId: string; menuName?: string; menuPrice?: number; menuCost?: number }[];
  };
  const sale = updatedState.sales.find(r => r.menuId === id)!;
  assert.equal(updatedState.menu.find(m => m.id === id)!.name, "Tomato toast special");
  assert.deepEqual([sale.menuName, sale.menuPrice, sale.menuCost], ["Tomato toast", 18, 5]);

  const archived = await request(`/guard/menu/${id}`, { active: false }, "PATCH");
  assert.equal((archived.data as { menu: { id: string; archivedAt: string | null }[] }).menu.find(m => m.id === id)!.archivedAt === null, false);
  assert.equal((archived.data as { forecasts: { menuId: string }[] }).forecasts.some(f => f.menuId === id), false);
  assert.equal((await request("/guard/records", { kind: "sales", rows: [{ date: today(), menuId: id, portions: 8 }] })).status, 200, "an existing date can be corrected after archive");
  assert.equal((await request("/guard/records", { kind: "sales", rows: [{ date: "2026-10-21", menuId: id, portions: 8 }] })).status, 400, "archived dishes cannot be added to a new date");

  const removed = await request(`/guard/menu/${id}`, undefined, "DELETE");
  assert.equal((removed.data as { menu: { id: string; archivedAt: string | null }[] }).menu.some(m => m.id === id && m.archivedAt !== null), true, "historical dishes are archived instead of erased");
  const unused = await request("/guard/menu", { ...newBody, name: "Unused dish" });
  const unusedId = (unused.data as { menu: { id: string; name: string }[] }).menu.find(m => m.name === "Unused dish")!.id;
  const deleted = await request(`/guard/menu/${unusedId}`, undefined, "DELETE");
  assert.equal((deleted.data as { menu: { id: string }[] }).menu.some(m => m.id === unusedId), false, "unused dishes can be permanently removed");
});
async function scan() {
  const response = await request("/guard/reorders/scan", {});
  assert.equal(response.status, 200);
  return (response.data as Reorders).plans.find(p => p.status === "PENDING_APPROVAL")!;
}
const endpoint = (id: string) => `/guard/reorders/${id}/decision`;
test("HTTP: what-if previews are validated and completely read-only; only explicit approval executes once", async () => {
  fixture();
  const p = await scan(), path = `/guard/reorders/${p.id}/preview`, before = snapshotWorkspace();
  for (const quantity of [2, 20, 0, 2]) {
    const response = await request(path, { quantity, deliveryDate: p.line.deliveryDate });
    assert.equal(response.status, 200);
    const result = PreviewReorderResponse.parse(response.data);
    assert.equal(result.scenario.quantity, quantity);
    assert.equal(result.scenario.purchaseCost, quantity * p.line.unitCost);
    assert.deepEqual(snapshotWorkspace(), before, "preview must not change activity, proposals, inventory, deliveries or notification records");
  }
  for (const body of [
    {}, { quantity: -1, deliveryDate: p.line.deliveryDate },
    { quantity: "2", deliveryDate: p.line.deliveryDate },
    { quantity: 2, deliveryDate: today() },
    { quantity: 2, deliveryDate: "not-a-date" },
  ]) {
    assert.equal((await request(path, body)).status, 400);
    assert.deepEqual(snapshotWorkspace(), before);
  }
  const approved = await request(endpoint(p.id), { decision: "approve", quantity: 2, deliveryDate: p.line.deliveryDate, approver: "What-if owner" });
  assert.equal(approved.status, 200);
  assert.equal((approved.data as Reorders).plans.find(x => x.id === p.id)!.status, "EXECUTED");
  const after = snapshotWorkspace();
  assert.equal(after.ingredients[0]!.deliveryQuantity, 2);
  assert.equal(after.ingredients[0]!.quantity, before.ingredients[0]!.quantity);
  assert.equal(after.activity.filter(x => x.title.startsWith("Reorder executed:")).length, 1);
  assert.equal((await request(path, { quantity: 3, deliveryDate: p.line.deliveryDate })).status, 400);
  assert.deepEqual(snapshotWorkspace(), after);
  await request(endpoint(p.id), { decision: "approve", quantity: 3, approver: "Replay" });
  assert.equal(snapshotWorkspace().ingredients[0]!.deliveryQuantity, 2);
  assert.equal(snapshotWorkspace().activity.filter(x => x.title.startsWith("Reorder executed:")).length, 1);
});

test("HTTP: rejected proposals cannot be previewed or executed by reusing a scenario", async () => {
  fixture();
  const p = await scan();
  await request(`/guard/reorders/${p.id}/preview`, { quantity: 2, deliveryDate: p.line.deliveryDate });
  await request(endpoint(p.id), { decision: "reject", approver: "Owner" });
  const rejected = snapshotWorkspace();
  assert.equal((await request(`/guard/reorders/${p.id}/preview`, { quantity: 2, deliveryDate: p.line.deliveryDate })).status, 400);
  assert.deepEqual(snapshotWorkspace(), rejected);
  await request(endpoint(p.id), { decision: "approve", quantity: 2, approver: "Replay" });
  assert.equal(snapshotWorkspace().ingredients[0]!.deliveryQuantity, rejected.ingredients[0]!.deliveryQuantity);
});
test("Auth: missing workspace context fails closed and concurrent owner contexts stay isolated", async () => {
  assert.throws(() => currentWorkspaceId(), /authenticated workspace/);
  await Promise.all(["a", "b"].map(id => inWorkspace(ownerWorkspaceId(id), async () => {
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(currentWorkspaceId(), ownerWorkspaceId(id));
  })));
});

test("HTTP auth: anonymous access is denied and owner data, approvals, preferences and review tokens are isolated", async () => {
  // Stub only Clerk's already-verified request identity, never the authorization
  // middleware. This test-only header is not read anywhere in production.
  const app = express();
  app.use(express.json());
  app.use("/guard", createOwnerAuth(req => req.get("test-owner") ?? null));
  app.use(guardRouter, reorderRouter, notificationsRouter, inboxRouter);
  const secured = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => secured.once("listening", resolve));
  const address = secured.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  const call = async (path: string, owner?: string, body?: unknown, method = "POST", extra: Record<string, string> = {}) => {
    const r = await fetch(url + path, {
      method: body === undefined ? "GET" : method,
      headers: { "Content-Type": "application/json", ...(owner ? { "test-owner": owner } : {}), ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json() as State & Reorders & typeof GetNotificationsResponse._output & typeof ReviewNotificationResponse._output };
  };
  const a = ownerWorkspaceId("auth-test-a"), b = ownerWorkspaceId("auth-test-b");
  const stateA = fixture();
  stateA.ingredients[0]!.name = "Private owner A";
  resetWorkspace(stateA, a);
  const stateB = seed(); stateB.ingredients[0]!.name = "Private owner B";
  resetWorkspace(stateB, b);
  try {
    for (const [path, body, method] of [
      ["/guard/state"], ["/guard/inbox"], ["/guard/notifications"],
      ["/guard/notifications", {}, "PATCH"], ["/guard/reorders/scan", {}],
      ["/guard/reorders/any/preview", { quantity: 2, deliveryDate: shift(today(), 2) }],
      ["/guard/recommendations/any/decision", {}], ["/guard/notifications/review", { token: "x".repeat(43) }],
    ] as const) {
      assert.equal((await call(path, undefined, body, method)).status, 401);
    }
    assert.equal((await call("/guard/state?workspaceId=owner:auth-test-a", "auth-test-b")).data.ingredients[0]!.name, "Private owner B");
    assert.equal((await call("/guard/state", "auth-test-a")).data.ingredients[0]!.name, "Private owner A");
    const historicalImport = await call("/guard/history/import", "auth-test-a", { rows: [
      { kind: "stock", date: shift(today(), -1), itemName: "Owner A archive item", quantity: 4, unit: "kg" },
    ] });
    assert.equal(historicalImport.status, 200);
    assert.equal(((await call("/guard/history", "auth-test-a")).data as { records: unknown[] }).records.length, 1);
    assert.equal(((await call("/guard/history", "auth-test-b")).data as { records: unknown[] }).records.length, 0, "another owner cannot read this archive");
    const batchId = (historicalImport.data as unknown as { batches: { id: string }[] }).batches[0]!.id;
    const archivePath = `/guard/history/batches/${encodeURIComponent(batchId)}`;
    const archiveA = snapshotWorkspace(a), archiveB = snapshotWorkspace(b);
    assert.equal((await call(archivePath, undefined, { confirmed: true }, "DELETE")).status, 401);
    assert.equal((await call(archivePath, "auth-test-b", { confirmed: true }, "DELETE")).status, 404);
    assert.deepEqual(snapshotWorkspace(a), archiveA);
    assert.deepEqual(snapshotWorkspace(b), archiveB);
    assert.equal((await call(archivePath, "auth-test-a", { confirmed: true }, "DELETE", { Origin: "https://attacker.example" })).status, 403);
    assert.deepEqual(snapshotWorkspace(a), archiveA);
    assert.equal((await call(archivePath, "auth-test-a", { confirmed: true }, "DELETE")).status, 200);
    assert.deepEqual({ ...snapshotWorkspace(a), historicalRecords: undefined }, { ...archiveA, historicalRecords: undefined });
    assert.deepEqual(snapshotWorkspace(b), archiveB);
    assert.equal((await call("/guard/state", "auth-test-a", undefined, undefined, { Origin: "https://attacker.example" })).status, 403);
    const plan = (await call("/guard/reorders/scan", "auth-test-a", {})).data.plans.find((p: { status: string }) => p.status === "PENDING_APPROVAL");
    assert.ok(plan);
    const previewBody = { quantity: 3, deliveryDate: plan.line.deliveryDate };
    assert.equal((await call(`/guard/reorders/${plan.id}/preview`, "auth-test-a", previewBody)).status, 200);
    assert.equal((await call(`/guard/reorders/${plan.id}/preview`, "auth-test-b", previewBody)).status, 400);
    const bBefore = snapshotWorkspace(b);
    const crossDecision = await call(endpoint(plan.id), "auth-test-b", { decision: "approve", quantity: 3, approver: "A" });
    assert.notEqual(crossDecision.status, 200);
    assert.deepEqual(snapshotWorkspace(b).ingredients, bBefore.ingredients);
    const prefs = { ...defaultNotificationSettings(), phone: "+60123456789", enabled: true, optIn: true };
    assert.equal((await call("/guard/notifications", "auth-test-a", prefs, "PATCH")).status, 200);
    const generated = (await call("/guard/notifications/scan", "auth-test-a", {})).data;
    assert.ok(generated.records.length);
    const token = generated.records[0].reviewUrl.split("#token=")[1];
    assert.equal((await call("/guard/notifications/review", "auth-test-a", { token })).status, 200);
    assert.equal((await call("/guard/notifications/review", "auth-test-b", { token })).status, 410);
    assert.equal((await call("/guard/notifications", "auth-test-b")).data.settings.phone, "");
    assert.equal(snapshotWorkspace(a).notifications?.sandbox, undefined);
    assert.equal(snapshotWorkspace(b).notifications?.sandbox, undefined);
    // No signed-in owner can pass the scheduler's separate credential gate.
    const tick = await fetch(url + "/guard/notifications/tick", { method: "POST", headers: { "test-owner": "auth-test-a" } });
    assert.ok([403, 503].includes(tick.status));
  } finally {
    await new Promise<void>((resolve, reject) => secured.close(error => error ? reject(error) : resolve()));
  }
});
test("HTTP: reading monitor status reports its heartbeat without migrating or changing inventory", async () => {
  fixture();
  const before = snapshotWorkspace();
  const response = await request("/guard/monitor-status");
  assert.equal(response.status, 200);
  const parsed = GetMonitorHeartbeatStatusResponse.parse(response.data);
  assert.equal(parsed.status, "not-started");
  assert.equal(parsed.lastSuccessfulAt, null);
  assert.deepEqual(snapshotWorkspace(), before);
});
async function requestInbox(body?: unknown) {
  const result = await request(body ? "/guard/inbox/update" : "/guard/inbox", body);
  assert.equal(result.status, 200);
  return { ...result, data: GetInboxResponse.parse(result.data) };
}

test("HTTP: inbox read state persists, reanalysis deduplicates, invalid mutations fail without executing", async () => {
  fixture();
  const initial = await requestInbox();
  assert.equal(initial.status, 200);
  const expiry = initial.data.items.find((i: { kind: string }) => i.kind === "expiry");
  assert.ok(expiry);
  const before = snapshotWorkspace();
  const read = await requestInbox({ action: "read", id: expiry.id });
  assert.equal(read.status, 200);
  assert.equal(read.data.unreadCount, initial.data.unreadCount - 1);
  assert.equal(read.data.items.find(i => i.id === expiry.id)!.resolvedAt, null);
  const reloaded = await requestInbox();
  assert.equal(reloaded.data.unreadCount, read.data.unreadCount);
  assert.equal(reloaded.data.items.length, initial.data.items.length);
  assert.equal(reloaded.data.items.find(i => i.id === expiry.id)!.readAt, read.data.items.find(i => i.id === expiry.id)!.readAt);
  for (const key of ["ingredients", "reordering", "decisions", "activity"] as const) assert.deepEqual(snapshotWorkspace()[key], before[key]);
  assert.equal((await request("/guard/inbox/update", { action: "approve", id: expiry.id })).status, 400);
  assert.equal((await request("/guard/inbox/update", { action: "read" })).status, 400);
  assert.equal((await request("/guard/inbox/update", { action: "read", id: "unknown" })).status, 404);
  const all = await requestInbox({ action: "read-all" });
  assert.equal(all.data.unreadCount, 0);
  assert.ok(all.data.counts.approaching > 0);
});

test("HTTP: inventory edits update/resolve alerts, threshold changes validate and persist", async () => {
  fixture();
  const first = await requestInbox();
  const item = first.data.items.find((i: { kind: string }) => i.kind === "expiry");
  assert.ok(item);
  const ingredient = snapshotWorkspace().ingredients[0]!;
  assert.equal((await request("/guard/records", { kind: "inventory", rows: [{ ...ingredient, quantity: 0 }] })).status, 200);
  const resolved = await requestInbox();
  assert.ok(resolved.data.items.find(i => i.id === item.id)!.resolvedAt);
  assert.equal(resolved.data.counts.approaching, 0);
  assert.equal((await request("/guard/inbox/thresholds", { warningDays: 4, upcomingDays: 9 }, "PATCH")).status, 200);
  assert.deepEqual((await requestInbox()).data.thresholds, { warningDays: 4, upcomingDays: 9 });
  assert.equal((await request("/guard/inbox/thresholds", { warningDays: 10, upcomingDays: 5 }, "PATCH")).status, 400);
  assert.equal((await request("/guard/inbox/thresholds", { warningDays: 0, upcomingDays: 5 }, "PATCH")).status, 400);
});

test("HTTP: pending approval read never executes; approved/rejected/stale outcomes reconcile and remain idempotent", async () => {
  for (const outcome of ["approve", "reject", "stale"] as const) {
    fixture(); const plan = await scan();
    const first = await requestInbox(), approvalId = `approval:${plan.id}`;
    const notice = first.data.items.find((i: { id: string }) => i.id === approvalId);
    assert.ok(notice); assert.match(notice.path, /reordering\?item=/);
    const before = structuredClone(snapshotWorkspace().ingredients);
    assert.equal((await request("/guard/inbox/update", { action: "dismiss", id: approvalId })).status, 400);
    assert.equal((await request("/guard/inbox/update", { action: "read", id: approvalId })).status, 200);
    assert.deepEqual(snapshotWorkspace().ingredients, before);
    if (outcome === "stale") {
      await request("/guard/records", { kind: "inventory", rows: [{ ...snapshotWorkspace().ingredients[0]!, quantity: 3 }] });
    }
    const decision = { decision: outcome === "reject" ? "reject" : "approve", approver: "Inbox HTTP owner" };
    assert.equal((await request(endpoint(plan.id), decision)).status, 200);
    const state = await requestInbox();
    assert.ok(state.data.items.find(i => i.id === approvalId)!.resolvedAt);
    const audit = snapshotWorkspace().activity.filter(a => a.detail.includes(`Proposal ${plan.id}.`));
    assert.equal(audit.length, 1);
    assert.ok(audit[0]!.time);
    if (outcome === "approve") assert.ok(state.data.items.some((i: { id: string; severity: string }) => i.id === `completed:${plan.id}` && i.severity === "success"));
    if (outcome === "reject") assert.deepEqual(snapshotWorkspace().ingredients, before);
    if (outcome === "stale") assert.ok(state.data.items.some((i: { id: string; severity: string }) => i.id === `failure:${plan.id}` && i.severity === "critical"));
    await request(endpoint(plan.id), decision);
    assert.equal(snapshotWorkspace().activity.filter(a => a.detail.includes(`Proposal ${plan.id}.`)).length, 1);
  }
});

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

test("HTTP: notification settings enforce opt-in, persist demo previews, mask recipients and expose no token hashes", async () => {
  fixture();
  let response = await request("/guard/notifications");
  assert.equal(response.status, 200);
  assert.equal(GetNotificationsResponse.parse(response.data).mode, "demo");
  const settings = { ...defaultNotificationSettings(), enabled: true, phone: "+60123456789", optIn: false };
  assert.equal((await request("/guard/notifications", settings, "PATCH")).status, 400);
  response = await request("/guard/notifications", { ...settings, optIn: true }, "PATCH");
  assert.equal(response.status, 200);
  const parsed = GetNotificationsResponse.parse(response.data);
  assert.equal(parsed.liveReady, false);
  assert.ok(parsed.records.length > 0);
  assert.equal(parsed.records[0]!.status, "demo");
  assert.match(parsed.records[0]!.recipient, /••••/);
  assert.ok(!JSON.stringify(response.data).includes("tokenHash"));
  const count = parsed.records.length;
  assert.equal(GetNotificationsResponse.parse((await request("/guard/notifications/scan", {})).data).records.length, count);
  assert.equal(GetNotificationsResponse.parse((await request("/guard/notifications")).data).settings.optIn, true);
});

test("HTTP: expiring read-only review token is invalidated on consent revocation and never approves", async () => {
  fixture();
  const settings = { ...defaultNotificationSettings(), enabled: true, phone: "+60123456789", optIn: true };
  const saved = await request("/guard/notifications", settings, "PATCH");
  const token = GetNotificationsResponse.parse(saved.data).records[0]!.reviewUrl.split("#token=")[1];
  const before = snapshotWorkspace();
  const review = await request("/guard/notifications/review", { token });
  assert.equal(review.status, 200);
  const parsedReview = ReviewNotificationResponse.parse(review.data);
  assert.equal(parsedReview.demo, true);
  assert.match(parsedReview.notice, /Read-only/);
  assert.deepEqual(snapshotWorkspace().ingredients, before.ingredients);
  assert.deepEqual(snapshotWorkspace().decisions, before.decisions);
  assert.equal((await request("/guard/notifications/review", { token: "x".repeat(43) })).status, 410);
  await request("/guard/notifications", { ...settings, enabled: false, optIn: false }, "PATCH");
  assert.equal((await request("/guard/notifications/review", { token })).status, 410);
});

test("HTTP: unsigned webhook is forbidden; verified status is monotonic and cannot convert demo into delivered", async () => {
  fixture();
  const previousSecret = process.env.WHATSAPP_APP_SECRET, previousPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
  process.env.WHATSAPP_APP_SECRET = "test-only-webhook-secret";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
  try {
    const settings = { ...defaultNotificationSettings(), enabled: true, phone: "+60123456789", optIn: true };
    await request("/guard/notifications", settings, "PATCH");
    const state = snapshotWorkspace();
    const demo = state.notifications!.records[0]!;
    demo.providerMessageId = "demo-provider-id";
    const live = { ...demo, id: "test-live", status: "accepted" as const, providerMessageId: "provider-id" };
    state.notifications!.records.push(live);
    resetWorkspace(state);
    const webhook = async (status: string, signature = true) => {
      const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ value: {
        metadata: { phone_number_id: "123456" },
        statuses: [{ id: "provider-id", status }, { id: "demo-provider-id", status }],
      } }] }] });
      return fetch(base + "/guard/notifications/webhook", {
        method: "POST", headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": signature ? `sha256=${createHmac("sha256", "test-only-webhook-secret").update(raw).digest("hex")}` : "invalid",
        }, body: raw,
      });
    };
    assert.equal((await webhook("delivered", false)).status, 403);
    assert.equal((await webhook("delivered")).status, 200);
    assert.equal(snapshotWorkspace().notifications!.records.find(r => r.id === "test-live")!.status, "delivered");
    await webhook("sent"); await webhook("failed");
    assert.equal(snapshotWorkspace().notifications!.records.find(r => r.id === "test-live")!.status, "delivered");
    assert.equal(snapshotWorkspace().notifications!.records.find(r => r.id === demo.id)!.status, "demo");
  } finally {
    if (previousSecret === undefined) delete process.env.WHATSAPP_APP_SECRET; else process.env.WHATSAPP_APP_SECRET = previousSecret;
    if (previousPhone === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID; else process.env.WHATSAPP_PHONE_NUMBER_ID = previousPhone;
  }
});

test("HTTP: scheduler scan requires a server bearer credential and never executes orders", async () => {
  fixture();
  const original = process.env.NOTIFICATIONS_CRON_SECRET;
  delete process.env.NOTIFICATIONS_CRON_SECRET;
  try {
    const tick = (key?: string) => fetch(base + "/guard/notifications/tick", {
      method: "POST", headers: key ? { Authorization: `Bearer ${key}` } : {},
    });
    assert.equal((await tick()).status, 503);
    process.env.NOTIFICATIONS_CRON_SECRET = "test-scheduler-only";
    assert.equal((await tick("wrong")).status, 403);
    // First load performs the backward-compatible batch migration. Compare
    // scheduler behavior against that current workspace shape, not legacy JSON.
    assert.equal((await request("/guard/state")).status, 200);
    const before = snapshotWorkspace().ingredients;
    assert.equal((await tick("test-scheduler-only")).status, 204);
    assert.deepEqual(snapshotWorkspace().ingredients, before);
    assert.deepEqual(snapshotWorkspace().decisions, {});
  } finally {
    if (original === undefined) delete process.env.NOTIFICATIONS_CRON_SECRET;
    else process.env.NOTIFICATIONS_CRON_SECRET = original;
  }
});

test("HTTP: receipts and corrections persist as independent batches without changing planned deliveries", async () => {
  fixture();
  const path = "/guard/ingredients/tomato/batches";
  const receipt = { quantity: 5, expiry: shift(today(), 8), receivedDate: today() };
  const response = await request(path, receipt);
  assert.equal(response.status, 200);
  let i = (response.data as State).ingredients[0]!;
  assert.equal(i.quantity, 6);
  assert.ok(i.batches);
  assert.equal(i.batches.length, 2);
  assert.equal(i.batches[0]!.receivedDate, null);
  assert.equal(i.deliveryQuantity, 4);
  const id = i.batches[1]!.id;
  assert.equal((await request(path, { ...receipt, id, quantity: 2 })).status, 200);
  const reload = await request("/guard/state");
  i = (reload.data as State).ingredients[0]!;
  assert.equal(i.quantity, 3);
  assert.equal(i.batches!.length, 2);
  assert.equal(i.batches![1]!.id, id);
  assert.equal(i.deliveryQuantity, 4);
  assert.equal((await request(path, { ...receipt, id, quantity: 0 })).status, 200);
  i = snapshotWorkspace().ingredients[0]!;
  assert.equal(i.quantity, 1);
  assert.equal(i.batches!.length, 2, "retain depleted batch identity");
});

test("HTTP: invalid receipts and destructive multi-batch imports are atomic failures", async () => {
  fixture();
  const path = "/guard/ingredients/tomato/batches";
  const receipt = { quantity: 2, expiry: shift(today(), 8), receivedDate: today() };
  await request(path, receipt);
  const before = snapshotWorkspace();
  for (const input of [
    { ...receipt, quantity: -1 }, { ...receipt, quantity: "2" },
    { ...receipt, expiry: "2026-02-30" }, { ...receipt, receivedDate: shift(today(), 1) },
    { ...receipt, receivedDate: null }, { ...receipt, id: "missing" },
    { ...receipt, expiry: shift(today(), -1) },
  ]) {
    assert.equal((await request(path, input)).status, 400);
    assert.deepEqual(snapshotWorkspace(), before);
  }
  const ingredient = before.ingredients[0]!;
  const imported = await request("/guard/records", { kind: "inventory", rows: [{ ...ingredient, quantity: 999 }] });
  assert.equal(imported.status, 400);
  assert.deepEqual(snapshotWorkspace(), before);
  assert.equal((await request("/guard/records", { kind: "inventory", rows: [{ ...ingredient, deliveryQuantity: 0 }] })).status, 200);
  assert.deepEqual(snapshotWorkspace().ingredients[0]!.batches, ingredient.batches);
});
test("HTTP auth: business profile saves per owner without changing operational records", async () => {
  const app = express();
  app.use(express.json());
  app.use("/guard", createOwnerAuth(req => req.get("test-owner") ?? null));
  app.use(guardRouter);
  const secured = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => secured.once("listening", resolve));
  const address = secured.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  const ownerA = "business-profile-a";
  const ownerB = "business-profile-b";
  const call = async (path: string, owner?: string, body?: unknown, method = "GET") => {
    const response = await fetch(url + path, {
      method,
      headers: { "Content-Type": "application/json", ...(owner ? { "test-owner": owner } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() as State };
  };

  try {
    const legacySample = seed();
    legacySample.activity[0]!.title = "Your café workspace is ready";
    resetWorkspace(legacySample, ownerWorkspaceId(ownerA));
    resetWorkspace(seed(), ownerWorkspaceId(ownerB));
    assert.equal((await call("/guard/business-profile", undefined, { name: "No access", type: "restaurant" }, "PATCH")).status, 401);

    const initial = await call("/guard/state", ownerA);
    assert.equal(initial.status, 200);
    assert.ok(initial.data.activity.some(event => event.title === "Your food-business workspace is ready"));
    assert.ok(snapshotWorkspace(ownerWorkspaceId(ownerA)).activity.some(event => event.title === "Your café workspace is ready"), "legacy sample history is not rewritten in storage");
    const before = snapshotWorkspace(ownerWorkspaceId(ownerA));
    const updated = await call("/guard/business-profile", ownerA, { name: "Riverfront Noodles", type: "food_vendor" }, "PATCH");
    assert.equal(updated.status, 200);
    assert.deepEqual(updated.data.businessProfile, { name: "Riverfront Noodles", type: "food_vendor" });
    assert.equal(updated.data.cafeName, "Riverfront Noodles", "legacy clients receive the configured name");

    const saved = snapshotWorkspace(ownerWorkspaceId(ownerA));
    assert.deepEqual(saved.ingredients, before.ingredients);
    assert.deepEqual(saved.menu, before.menu);
    assert.deepEqual(saved.sales, before.sales);
    assert.deepEqual(saved.results, before.results);
    const ownerBState = await call("/guard/state", ownerB);
    assert.equal(ownerBState.data.businessProfile.name, "Sample Food Business");
    assert.equal(ownerBState.data.businessProfile.type, "other");

    assert.equal((await call("/guard/business-profile", ownerA, { name: "   ", type: "restaurant" }, "PATCH")).status, 400);
    assert.equal((await call("/guard/business-profile", ownerA, { name: "Invalid type", type: "caterer" }, "PATCH")).status, 400);
    assert.deepEqual(snapshotWorkspace(ownerWorkspaceId(ownerA)).businessProfile, { name: "Riverfront Noodles", type: "food_vendor" });
  } finally {
    await new Promise<void>((resolve, reject) => secured.close(error => error ? reject(error) : resolve()));
  }
});

test("HTTP auth: workspace data choice is owner-scoped and removes only the confirmed demo records", async () => {
  const app = express();
  app.use(express.json());
  app.use("/guard", createOwnerAuth(req => req.get("test-owner") ?? null));
  app.use(guardRouter, createGuardMenuRouter());
  const secured = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => secured.once("listening", resolve));
  const address = secured.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  const ownerA = "workspace-setup-a";
  const ownerB = "workspace-setup-b";
  const call = async (path: string, owner?: string, body?: unknown, method = "GET") => {
    const response = await fetch(url + path, {
      method,
      headers: { "Content-Type": "application/json", ...(owner ? { "test-owner": owner } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() as State };
  };

  try {
    const initialOwnerA = seed();
    initialOwnerA.historicalRecords = [{
      id: "archive-stock",
      kind: "stock",
      date: today(),
      importedAt: new Date().toISOString(),
      itemName: "Imported cabbage",
      quantity: 2,
      unit: "kg",
    }];
    resetWorkspace(initialOwnerA, ownerWorkspaceId(ownerA));
    resetWorkspace(seed(), ownerWorkspaceId(ownerB));

    assert.equal((await call("/guard/workspace/setup", undefined, { mode: "owner_data", confirmReplaceSamples: true }, "POST")).status, 401);
    const keptDemo = await call("/guard/workspace/setup", ownerA, { mode: "synthetic_demo" }, "POST");
    assert.equal(keptDemo.status, 200);
    assert.equal(keptDemo.data.workspaceMode, "synthetic_demo");
    assert.equal(keptDemo.data.synthetic, true);
    assert.ok(keptDemo.data.sales.length > 0);

    const unconfirmed = await call("/guard/workspace/setup", ownerA, { mode: "owner_data" }, "POST");
    assert.equal(unconfirmed.status, 400);
    assert.ok(snapshotWorkspace(ownerWorkspaceId(ownerA)).sales.length > 0, "unconfirmed replacement leaves the demo unchanged");

    const ownerMode = await call("/guard/workspace/setup", ownerA, { mode: "owner_data", confirmReplaceSamples: true }, "POST");
    assert.equal(ownerMode.status, 200);
    assert.equal(ownerMode.data.workspaceMode, "owner_data");
    assert.equal(ownerMode.data.synthetic, false);
    assert.deepEqual(ownerMode.data.ingredients, []);
    assert.deepEqual(ownerMode.data.menu, []);
    assert.deepEqual(ownerMode.data.sales, []);
    assert.deepEqual(ownerMode.data.results, []);
    assert.equal(snapshotWorkspace(ownerWorkspaceId(ownerA)).historicalRecords?.[0]?.itemName, "Imported cabbage");
    assert.equal((await call("/guard/workspace/setup", ownerA, { mode: "synthetic_demo" }, "POST")).status, 400, "an owner-data workspace cannot silently revert to demo mode");

    const ingredientState = await call("/guard/records", ownerA, {
      kind: "inventory",
      rows: [{ name: "Green beans", quantity: 5, unit: "kg", expiry: shift(today(), 5), cost: 4 }],
    }, "POST");
    assert.equal(ingredientState.status, 200);
    const ingredient = ingredientState.data.ingredients.find(item => item.name === "Green beans");
    assert.ok(ingredient);
    const menuState = await call("/guard/menu", ownerA, {
      name: "Green bean bowl",
      description: "A sample owner-entered dish.",
      price: 14,
      cost: 5,
      recipe: [{ ingredientId: ingredient!.id, amount: 0.2 }],
    }, "POST");
    assert.equal(menuState.status, 201);
    assert.equal(menuState.data.menu.some(item => item.name === "Green bean bowl"), true);
    assert.equal(menuState.data.forecasts.find(item => item.name === "Green bean bowl")?.confidence, "No sales history");
    assert.equal(menuState.data.recommendations.some(item => item.type === "preparation" && item.targetId === ingredient!.id), false);

    const ownerBState = await call("/guard/state", ownerB);
    assert.equal(ownerBState.data.workspaceMode, "setup_required");
    assert.equal(ownerBState.data.synthetic, true);
    assert.ok(ownerBState.data.ingredients.some(item => item.name === "Cherry tomatoes"));
    assert.ok(ownerBState.data.menu.some(item => item.name === "Avocado Toast"));
    assert.equal(ownerBState.data.ingredients.some(item => item.name === "Green beans"), false);
    assert.equal(ownerBState.data.menu.some(item => item.name === "Green bean bowl"), false);
  } finally {
    await new Promise<void>((resolve, reject) => secured.close(error => error ? reject(error) : resolve()));
  }
});
