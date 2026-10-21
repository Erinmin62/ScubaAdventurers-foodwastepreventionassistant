import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, seed, shift, today, type Stored } from "./guard-model";
import { cancelOutstanding, completeFollowUp, scheduleFollowUp } from "./guard-follow-ups";
import { syncStock } from "./guard-batches";

test("multi-batch follow-ups preserve expiry snapshots and cannot flatten batch counts", () => {
  const s = seed(), i = s.ingredients[0]!;
  i.batches = [
    { id: "expired", quantity: 5, expiry: shift(today(), -1), receivedDate: null },
    { id: "safe", quantity: 10, expiry: shift(today(), 5), receivedDate: today() },
  ];
  syncStock(i);
  const rec = compute(s).recommendations.find(r => r.type === "purchase" && r.targetId === i.id)!;
  scheduleFollowUp(s, rec, rec.suggested, 2, null);
  const f = s.followUps![0]!;
  assert.ok(f.ingredients[0]!.expectedUsage > 0, "expired first batch must not hide safe later stock");
  assert.ok(f.ingredients[0]!.expectedUsage <= 10);
  assert.deepEqual(f.ingredients[0]!.batches, i.batches);
  const snapshot = structuredClone(f.ingredients);
  i.batches[1]!.expiry = shift(today(), 10);
  i.measuredDate = shift(today(), -1);
  const before = structuredClone(i);
  completeFollowUp(s, f.id, { ...outcome(f), updateInventory: true });
  assert.deepEqual(i, before);
  assert.match(f.outcome!.rows[0]!.inventoryUpdate, /multiple expiry batches/);
  assert.deepEqual(f.ingredients, snapshot);
});

function setup(type = "purchase", targetId = "tomato", days: 1 | 2 = 2) {
  const s = seed();
  const rec = compute(s).recommendations.find(r => r.type === type && r.targetId === targetId)!;
  assert.ok(rec);
  scheduleFollowUp(s, rec, rec.suggested, days, new Date().toISOString());
  return { s, rec, f: s.followUps![0]! };
}
function outcome(f: NonNullable<Stored["followUps"]>[number], observationDate = today(), remaining = 0) {
  return { observationDate, actionTaken: "Checked stock and reviewed the internal plan.", updateInventory: false, rows: f.ingredients.map(i => ({ ingredientId: i.ingredientId, remaining, wasted: 0.25 })) };
}

test("default two-calendar-day snapshot and explicit one-day schedule use KL date", () => {
  const { f } = setup();
  assert.equal(f.scheduledDate, shift(today(), 2));
  assert.equal(setup("use-first", "tomato", 1).f.scheduledDate, shift(today(), 1));
  assert.equal(f.ingredients[0]!.unit, "kg");
  assert.equal(f.approvedAt?.slice(0, 4), new Date().toISOString().slice(0, 4));
});
test("preparation follows all dish ingredients in a single immutable snapshot", () => {
  const { s, f } = setup("preparation", "avo-toast");
  assert.deepEqual(f.ingredients.map(i => i.ingredientId), ["avocado", "bread", "tomato"]);
  const before = structuredClone(f);
  s.ingredients[0]!.quantity = 900;
  s.menu[0]!.recipe[0]!.amount = 50;
  compute(s);
  assert.deepEqual(f, before);
});
test("forecast does not add planned deliveries to remaining stock", () => {
  const { s, rec, f } = setup();
  const expected = f.ingredients[0]!.expectedRemaining;
  s.ingredients[0]!.deliveryQuantity = 999;
  s.followUps = [];
  scheduleFollowUp(s, rec, rec.suggested, 2, null);
  assert.equal(s.followUps![0]!.ingredients[0]!.expectedRemaining, expected);
});
test("follow-ups survive KL day boundary, recommendation regeneration, and JSON reload", t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-20T15:59:00Z") });
  const { s, f } = setup();
  const oldIds = compute(s).recommendations.map(r => r.id);
  t.mock.timers.tick(120000);
  assert.equal(today(), "2026-10-21");
  const reloaded = JSON.parse(JSON.stringify(s));
  assert.deepEqual(compute(reloaded).followUps[0], f);
  assert.ok(compute(reloaded).recommendations.every(r => !oldIds.includes(r.id)));
});
test("legacy documents default to no follow-ups and do not fabricate measurement dates", () => {
  const s = seed();
  assert.deepEqual(compute(s).followUps, []);
  assert.equal(s.ingredients[0]!.measuredDate, undefined);
  const rec = compute(s).recommendations.find(r => r.type === "purchase")!;
  scheduleFollowUp(s, rec, rec.suggested, 2, null);
  assert.equal(s.followUps![0]!.approvedAt, null);
  assert.equal(s.followUps![0]!.startingDate, today());
});
test("past approved decisions remain explicitly attachable after date-keyed recommendations disappear", t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-20T04:00:00Z") });
  const s = seed();
  const rec = compute(s).recommendations.find(r => r.type === "purchase" && r.targetId === "tomato")!;
  s.decisions[rec.id] = { decision: "approved", quantity: 2, original: rec.original, savings: 0 };
  t.mock.timers.tick(3 * 86400000);
  const state = compute(s);
  assert.ok(!state.recommendations.some(r => r.id === rec.id));
  const legacy = state.approvedRecommendations.find(r => r.id === rec.id)!;
  assert.ok(legacy);
  assert.match(legacy.description, /were not saved/);
  scheduleFollowUp(s, legacy, 2, 2, null);
  assert.equal(s.followUps![0]!.approvedAt, null);
  assert.equal(s.followUps![0]!.startingDate, "2026-10-23");
});
test("retries and repeated attachment do not duplicate completed or outstanding checks", () => {
  const { s, rec, f } = setup();
  scheduleFollowUp(s, rec, rec.suggested, 1, null);
  assert.equal(s.followUps!.length, 1);
  completeFollowUp(s, f.id, outcome(f));
  scheduleFollowUp(s, rec, rec.suggested, 2, null);
  assert.equal(s.followUps!.length, 1);
  assert.throws(() => completeFollowUp(s, f.id, outcome(f)), /already completed/);
});
test("revision cancels old outstanding snapshot and preserves completed observations", () => {
  const { s, rec, f } = setup();
  cancelOutstanding(s, rec.id, "Revised");
  scheduleFollowUp(s, rec, 1, 1, new Date().toISOString(), true);
  assert.equal(f.status, "cancelled");
  const revised = s.followUps![1]!;
  completeFollowUp(s, revised.id, outcome(revised));
  const saved = structuredClone(revised);
  cancelOutstanding(s, rec.id, "Rejected");
  scheduleFollowUp(s, rec, 2, 2, new Date().toISOString(), true);
  assert.deepEqual(revised, saved);
  cancelOutstanding(s, rec.id, "Rejected");
  assert.equal(s.followUps!.filter(f => f.status === "outstanding").length, 0);
  assert.ok(s.activity.some(a => a.decision === "cancelled"));
});
test("rejects invalid, future, pre-start dates and whitespace action", () => {
  for (const observationDate of ["2026-02-30", shift(today(), 1), shift(today(), -1)]) {
    const { s, f } = setup();
    assert.throws(() => completeFollowUp(s, f.id, outcome(f, observationDate)));
    assert.equal(f.status, "outstanding");
  }
  const { s, f } = setup();
  assert.throws(() => completeFollowUp(s, f.id, { ...outcome(f), actionTaken: "  " }), /required/);
});
test("rejects non-finite, negative, extra, duplicate or missing ingredient quantities", () => {
  for (const value of [-1, NaN, Infinity, 1000001]) {
    const { s, f } = setup();
    assert.throws(() => completeFollowUp(s, f.id, outcome(f, today(), value)), /finite/);
  }
  const { s, f } = setup("preparation", "avo-toast");
  const input = outcome(f);
  assert.throws(() => completeFollowUp(s, f.id, { ...input, rows: input.rows.slice(1) }), /exactly one/);
  assert.throws(() => completeFollowUp(s, f.id, { ...input, rows: input.rows.map(() => input.rows[0]!) }), /exactly one/);
});
test("updates stock only with explicit confirmation and retains snapshot units", () => {
  for (const updateInventory of [false, true]) {
    const { s, f } = setup();
    const start = s.ingredients[0]!.quantity;
    completeFollowUp(s, f.id, { ...outcome(f, today(), 1.5), updateInventory });
    assert.equal(s.ingredients[0]!.quantity, updateInventory ? 1.5 : start);
    if (updateInventory) assert.equal(s.ingredients[0]!.measuredDate, today());
    assert.equal(f.ingredients[0]!.startingQuantity, start);
  }
});
test("historical observation never overwrites newer, same-day or unknown inventory", t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-20T04:00:00Z") });
  for (const measurement of [null, "2026-10-20", "2026-10-21"]) {
    const { s, f } = setup();
    s.ingredients[0]!.measuredDate = measurement;
    const start = s.ingredients[0]!.quantity;
    t.mock.timers.setTime(new Date("2026-10-22T04:00:00Z").getTime());
    completeFollowUp(s, f.id, { ...outcome(f, "2026-10-20", 1), updateInventory: true });
    assert.equal(s.ingredients[0]!.quantity, start);
    assert.match(f.outcome!.rows[0]!.inventoryUpdate, /Not updated/);
    t.mock.timers.setTime(new Date("2026-10-20T04:00:00Z").getTime());
  }
});
test("historical observation can update an explicitly older dated inventory measurement", t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-20T04:00:00Z") });
  const { s, f } = setup();
  s.ingredients[0]!.measuredDate = "2026-10-20";
  t.mock.timers.tick(2 * 86400000);
  completeFollowUp(s, f.id, { ...outcome(f, "2026-10-21", 1), updateInventory: true });
  assert.equal(s.ingredients[0]!.quantity, 1);
  assert.equal(s.ingredients[0]!.measuredDate, "2026-10-21");
});
test("expired stock gets disposal guidance even off schedule", t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-20T04:00:00Z") });
  const { s, f } = setup();
  t.mock.timers.tick(3 * 86400000);
  completeFollowUp(s, f.id, outcome(f, today(), 0.5));
  assert.equal(f.outcome!.rows[0]!.assessment, "expired stock requiring safe disposal");
  assert.match(f.outcome!.rows[0]!.nextAction, /Never use/);
});
test("date mismatch yields insufficient information, never inferred consumption", () => {
  const { s, f } = setup();
  completeFollowUp(s, f.id, outcome(f, today(), 2));
  assert.equal(f.outcome!.rows[0]!.assessment, "insufficient information to assess");
  assert.match(s.activity[0]!.detail, /does not establish consumption/);
});
test("scheduled comparison distinguishes on-track stock and unresolved risk", t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-20T04:00:00Z") });
  for (const [remaining, expected] of [[0, "stock on track"], [100, "unresolved excess/expiry risk"]] as const) {
    const { s, f } = setup("purchase", "coffee");
    t.mock.timers.setTime(new Date(`${f.scheduledDate}T04:00:00Z`).getTime());
    completeFollowUp(s, f.id, outcome(f, today(), remaining));
    assert.equal(f.outcome!.rows[0]!.assessment, expected);
    t.mock.timers.setTime(new Date("2026-10-20T04:00:00Z").getTime());
  }
});
test("ingredient discarded measurements do not change prepared-food waste or savings", () => {
  const { s, f } = setup();
  const before = compute(s).summary;
  completeFollowUp(s, f.id, outcome(f));
  assert.deepEqual(compute(s).summary, before);
  assert.equal(s.activity[0]!.impact, 0);
  assert.ok(JSON.parse(JSON.stringify(s)).followUps[0].outcome);
});
