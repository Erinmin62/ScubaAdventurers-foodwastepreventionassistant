import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, seed, shift, today, type Stored } from "./guard-model";
import { migrateBatches, safeStock, syncStock } from "./guard-batches";
import { analyzeReorders, decideReorder, scanReorders } from "./guard-reorder";
import { runWorkflows } from "./guard-automation";

test("legacy migration preserves quantities, unknown receipt dates, deliveries and history on repeated JSON reload", () => {
  const s = seed(), before = structuredClone(s);
  s.ingredients[0]!.quantity = 1.2345;
  migrateBatches(s);
  assert.equal(s.ingredients[0]!.quantity, 1.2345);
  for (const i of s.ingredients) {
    assert.equal(i.batches!.length, 1);
    assert.equal(i.batches![0]!.receivedDate, null);
    assert.equal(i.batches![0]!.quantity, i.quantity);
    assert.equal(i.deliveryQuantity, before.ingredients.find(v => v.id === i.id)!.deliveryQuantity);
    assert.equal(i.measuredDate, undefined);
  }
  const reloaded = JSON.parse(JSON.stringify(s));
  migrateBatches(reloaded);
  assert.deepEqual(reloaded, s);
  assert.deepEqual(s.activity, before.activity);
});

test("mixed expiry batches use FEFO regardless of input order and do not consume future stock early", () => {
  const s = fixture(0, 0), i = s.ingredients[0]!;
  i.batches = [
    { id: "later", quantity: 4, expiry: shift(today(), 10), receivedDate: today() },
    { id: "expired", quantity: 3, expiry: shift(today(), -1), receivedDate: null },
    { id: "early", quantity: 2, expiry: shift(today(), 1), receivedDate: today() },
  ];
  syncStock(i);
  const before = structuredClone(i), analysis = line(s);
  assert.equal(i.quantity, 9);
  assert.equal(safeStock(i, shift(today(), 1)), 6);
  assert.equal(analysis.expiredQuantity, 3);
  assert.equal(analysis.recommendedQuantity, 0, "6 safe units cover three days at 2/day");
  assert.equal(analysis.wasteQuantity, 3, "only expired units are wasted when early stock is consumed first");
  assert.equal(analysis.shortageBeforeDelivery, 0);
  assert.deepEqual(i, before, "simulations never alter stock");
  i.batches.reverse();
  assert.deepEqual(line(s), analysis);
  i.batches.find(b => b.id === "early")!.expiry = today();
  syncStock(i);
  assert.equal(line(s).recommendedQuantity, 2, "today-expiring stock cannot cover tomorrow");
  assert.equal(line(s).shortageBeforeDelivery, 0);
});

test("batch-only expiry corrections invalidate owner approvals even with unchanged aggregate stock", () => {
  const s = fixture(0, 4), i = s.ingredients[0]!;
  migrateBatches(s);
  scanReorders(s);
  const plan = s.reordering!.plans[0]!;
  i.batches!.push({ id: "later", quantity: 0, expiry: shift(today(), 20), receivedDate: today() });
  decideReorder(s, plan.id, { decision: "approve", approver: "Demo owner" });
  assert.equal(plan.status, "FAILED");
  assert.equal(i.deliveryQuantity, 4);
});

test("tomorrow capacity includes later safe batches even when the earliest batch is expired", () => {
  const s = seed(), i = s.ingredients.find(i => i.id === "avocado")!;
  i.batches = [
    { id: "old", quantity: 30, expiry: shift(today(), -1), receivedDate: null },
    { id: "safe", quantity: 0.9, expiry: shift(today(), 2), receivedDate: today() },
  ];
  syncStock(i);
  assert.equal(compute(s).forecasts.find(f => f.menuId === "avo-toast")!.capacity, 10);
  assert.equal(safeStock(i, shift(today(), 1)), 0.9);
});

function fixture(quantity = 0, incoming = 0, usage = 2): Stored {
  const s = seed();
  s.ingredients = [{ id: "tomato", name: "Tomatoes", unit: "kg", quantity, expiry: shift(today(), 10), cost: 10, category: "Vegetables", deliveryQuantity: incoming, deliveryDate: shift(today(), 2) }];
  s.reordering = { settings: [{ ingredientId: "tomato", leadDays: 2, reviewDays: 2, minOrder: 1, safetyStock: 0, shelfDays: 5, dailyUsage: usage }], plans: [] };
  return s;
}
const line = (s: Stored) => analyzeReorders(s)[0]!;
function proposal(s: Stored) { scanReorders(s); return s.reordering!.plans[0]!; }
test("enough stock and incoming: no additional purchase; stock is not double-counted", () => {
  const s = fixture(4, 3);
  const l = line(s);
  assert.equal(l.recommendedQuantity, 2);
  assert.equal(l.additionalQuantity, 0);
  assert.equal(l.expectedDemand, 6);
  assert.match(l.explanation, /Reduce/);
  assert.equal(l.originalCost, 30); assert.equal(l.proposedCost, 20);
});
test("insufficient safe stock: cover demand after arrival, report pre-arrival shortage", () => {
  const s = fixture();
  assert.equal(line(s).recommendedQuantity, 4);
  assert.equal(line(s).shortageBeforeDelivery, 2);
  assert.equal(line(s).additionalQuantity, 4);
});
test("current stock covers demand: skip incoming purchase", () => {
  assert.equal(line(fixture(20, 4)).recommendedQuantity, 0);
});
test("at-risk stock: FEFO uses short-dated current stock ahead of longer-lived incoming", () => {
  const s = fixture(8, 4);
  s.ingredients[0]!.expiry = shift(today(), 1);
  const l = line(s);
  assert.equal(l.wasteQuantity, 6);
  assert.equal(l.wasteCost, 60);
  assert.match(l.explanation, /use safe stock first/);
  assert.equal(l.recommendedQuantity, 4);
});
test("FEFO also prioritizes shorter-lived incoming ahead of current stock", () => {
  const s = fixture(6, 4);
  s.ingredients[0]!.expiry = shift(today(), 4);
  s.reordering!.settings[0]!.shelfDays = 1;
  // Day 1: current -2. Day 2: incoming -2; remainder 2 expires.
  // Days 3,4: current -4. Only 2 incoming is wasted, not 4.
  assert.equal(line(s).wasteQuantity, 2);
});
test("incoming delivery before stock is needed: reduce total, no additional order", () => {
  const s = fixture(4, 4);
  s.ingredients[0]!.deliveryDate = shift(today(), 1);
  assert.equal(line(s).recommendedQuantity, 0);
  assert.equal(line(s).additionalQuantity, 0);
});
test("expired stock never reduces purchasing need", () => {
  const s = fixture(8);
  s.ingredients[0]!.expiry = shift(today(), -1);
  assert.equal(line(s).expiredQuantity, 8);
  assert.equal(line(s).recommendedQuantity, 4);
  assert.ok(line(s).wasteCost >= 80);
});
test("minimum quantities and safety stock are respected", () => {
  const s = fixture();
  s.reordering!.settings[0]!.minOrder = 6;
  assert.equal(line(s).recommendedQuantity, 6);
  s.reordering!.settings[0]!.safetyStock = 4;
  assert.equal(line(s).recommendedQuantity, 8);
});
test("piece orders round upwards and minimums that increase expiry waste are flagged", () => {
  const s = fixture(0, 0, 1.3);
  s.ingredients[0]!.unit = "pcs";
  assert.equal(line(s).recommendedQuantity, 3);
  const p = proposal(s);
  decideReorder(s, p.id, { decision: "approve", approver: "Demo owner", quantity: 2.5 });
  assert.equal(p.status, "FAILED");
  assert.match(p.detail, /whole quantities/);
  assert.equal(p.beforeQuantity, p.afterQuantity);
  s.reordering!.settings[0]!.minOrder = 100;
  assert.ok(line(s).assumptions.some(a => /increases modeled expiry waste/.test(a)));
});
test("missing history blocks approval; missing supplier terms are explicit synthetic assumptions", () => {
  const s = fixture();
  delete s.reordering;
  s.sales = [];
  const l = line(s);
  assert.equal(l.demandAvailable, false);
  assert.ok(l.assumptions.some(a => /Synthetic defaults/.test(a)));
  assert.ok(l.assumptions.some(a => /Missing recent/.test(a)));
  const p = proposal(s);
  decideReorder(s, p.id, { decision: "approve", approver: "Demo owner" });
  assert.equal(p.status, "FAILED");
  assert.equal(s.ingredients[0]!.deliveryQuantity, 0);
});
test("unreceived past/today deliveries block overwriting and are never counted as stock", () => {
  const s = fixture(0, 4);
  s.ingredients[0]!.deliveryDate = today();
  const l = line(s);
  assert.equal(l.demandAvailable, false);
  assert.ok(l.assumptions.some(a => /unconfirmed/.test(a)));
});
test("owner edits and approves; only simulated delivery changes; duplicate approval is no-op", () => {
  const s = fixture(0, 2), beforeStock = s.ingredients[0]!.quantity;
  const p = proposal(s);
  assert.equal(s.ingredients[0]!.deliveryQuantity, 2, "scan never executes");
  decideReorder(s, p.id, { decision: "approve", approver: "Demo owner", quantity: 5, deliveryDate: shift(today(), 3) });
  assert.equal(p.status, "EXECUTED");
  assert.equal(p.approvedQuantity, 5);
  assert.equal(p.approver, "Demo owner");
  assert.ok(p.decidedAt);
  assert.equal(p.beforeQuantity, 2); assert.equal(p.afterQuantity, 5);
  assert.equal(s.ingredients[0]!.deliveryQuantity, 5);
  assert.equal(s.ingredients[0]!.quantity, beforeStock);
  const saved = JSON.stringify(s);
  decideReorder(s, p.id, { decision: "approve", approver: "Demo owner", quantity: 5 });
  assert.equal(JSON.stringify(s), saved);
});
test("rejected proposal and subsequent duplicate approval never execute", () => {
  const s = fixture(0, 2), p = proposal(s);
  decideReorder(s, p.id, { decision: "reject", approver: "Demo owner" });
  assert.equal(p.status, "REJECTED");
  const saved = JSON.stringify(s);
  decideReorder(s, p.id, { decision: "approve", approver: "Demo owner" });
  assert.equal(JSON.stringify(s), saved);
  assert.equal(s.ingredients[0]!.deliveryQuantity, 2);
});
test("execution failure is terminal, logged, and staged writes cannot corrupt stock", () => {
  const s = fixture(1, 2), p = proposal(s), original = structuredClone(s.ingredients);
  decideReorder(s, p.id, { decision: "approve", approver: "Demo owner" }, staged => { staged.quantity = 999; throw new Error("Injected supplier simulation failure"); });
  assert.equal(p.status, "FAILED");
  assert.deepEqual(s.ingredients, original);
  assert.match(p.detail, /Not executed/);
  assert.equal(s.activity[0]!.decision, "failed");
  scanReorders(s);
  assert.equal(s.reordering!.plans[0]!.status, "PENDING_APPROVAL", "a new scan allows fresh review after failure");
});
test("stale stock/configuration and invalid edited dates/quantities fail safely", () => {
  const s = fixture(1, 2), p = proposal(s);
  s.ingredients[0]!.quantity = 3;
  decideReorder(s, p.id, { decision: "approve", approver: "Demo owner" });
  assert.equal(p.status, "FAILED"); assert.match(p.detail, /changed/);
  assert.equal(s.ingredients[0]!.deliveryQuantity, 2);
  for (const input of [{ quantity: 0.5 }, { deliveryDate: "2026-02-31" }, { quantity: Infinity }]) {
    const next = proposal(s);
    decideReorder(s, next.id, { decision: "approve", approver: "Demo owner", ...input });
    assert.equal(next.status, "FAILED");
    assert.equal(s.ingredients[0]!.deliveryQuantity, 2);
  }
});
test("automated scans create drafts only and repeat scans do not duplicate unchanged drafts", () => {
  const s = fixture(1, 2);
  const before = structuredClone(s.ingredients);
  runWorkflows(s);
  assert.equal(s.reordering!.plans.length, 1);
  assert.equal(s.reordering!.plans[0]!.status, "PENDING_APPROVAL");
  assert.equal(s.reordering!.plans[0]!.detail, "", "pending status is sufficient; no redundant boilerplate detail");
  assert.deepEqual(s.ingredients, before);
  scanReorders(s); assert.equal(s.reordering!.plans.length, 1);
  s.reordering!.settings[0]!.dailyUsage = 3;
  scanReorders(s);
  assert.equal(s.reordering!.plans.length, 2);
  assert.equal(s.reordering!.plans[1]!.status, "SUPERSEDED");
});
