import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, seed, today } from "./guard-model";
import { runWorkflows } from "./guard-automation";
import { completeFollowUp, scheduleFollowUp } from "./guard-follow-ups";

test("first check enables both workflows and persists a review without approving or changing stock", () => {
  const s = seed(), before = structuredClone(s);
  runWorkflows(s);
  assert.equal(s.automation?.dailyPlanning, true);
  assert.equal(s.automation?.followUpHandling, true);
  assert.equal(s.automation?.runs.length, 2);
  assert.deepEqual(s.ingredients, before.ingredients);
  assert.deepEqual(s.decisions, before.decisions);
  assert.deepEqual(s.results, before.results);
  assert.deepEqual(s.sales, before.sales);
  assert.equal(s.automation?.runs.find(r => r.workflow === "daily-planning")?.predictedPortions, compute(s).summary.predictedPortions);
});
test("same-day reads do not duplicate runs or activity, including after reload", () => {
  const s = seed();
  runWorkflows(s);
  const reloaded = JSON.parse(JSON.stringify(s));
  const before = JSON.stringify(reloaded);
  runWorkflows(reloaded);
  assert.equal(JSON.stringify(reloaded), before);
});
test("paused workflows do not run automatically or through manual run", () => {
  const s = seed();
  s.automation = { dailyPlanning: false, followUpHandling: false, runs: [] };
  runWorkflows(s);
  assert.equal(s.automation.runs.length, 0);
  assert.throws(() => runWorkflows(s, "daily-planning"), /Enable/);
  assert.throws(() => runWorkflows(s, "follow-ups"), /Enable/);
  assert.throws(() => runWorkflows(s, "all"), /Enable/);
  assert.ok(compute(s).risks.some(r => r.level === "expired"), "Safety checks stay available while automation is paused");
});
test("manual all skips paused workflows and records a manual trigger", () => {
  const s = seed();
  s.automation = { dailyPlanning: true, followUpHandling: false, runs: [] };
  runWorkflows(s, "all");
  assert.equal(s.automation.runs.length, 1);
  assert.equal(s.automation.runs[0]?.trigger, "manual");
  assert.equal(s.automation.runs[0]?.workflow, "daily-planning");
});
test("Kuala Lumpur day boundary produces one new daily run per enabled workflow", t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-20T15:59:00Z") });
  const s = seed();
  runWorkflows(s);
  assert.equal(today(), "2026-10-20");
  t.mock.timers.tick(120_000);
  runWorkflows(s);
  assert.equal(today(), "2026-10-21");
  assert.equal(s.automation?.runs.length, 4);
  runWorkflows(s);
  assert.equal(s.automation?.runs.length, 4);
});
test("due and overdue scans preserve snapshots and never manufacture observations", t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-20T04:00:00Z") });
  const s = seed(), rec = compute(s).recommendations.find(r => r.type === "purchase")!;
  scheduleFollowUp(s, rec, rec.suggested, 1, new Date().toISOString());
  const snapshot = structuredClone(s.followUps![0]!);
  runWorkflows(s);
  t.mock.timers.tick(86400000);
  runWorkflows(s);
  assert.equal(s.automation?.runs[0]?.dueCount, 1);
  t.mock.timers.tick(86400000);
  runWorkflows(s);
  assert.equal(s.automation?.runs[0]?.overdueCount, 1);
  assert.deepEqual(s.followUps![0], snapshot);
  assert.equal(s.followUps![0]?.outcome, null);
  const count = s.automation?.runs.length;
  runWorkflows(s);
  assert.equal(s.automation?.runs.length, count);
  completeFollowUp(s, snapshot.id, { observationDate: today(), actionTaken: "Counted stock.", updateInventory: false, rows: snapshot.ingredients.map(i => ({ ingredientId: i.ingredientId, remaining: 0, wasted: 0 })) });
  runWorkflows(s, "follow-ups");
  assert.equal(s.automation?.runs[0]?.overdueCount, 0);
});
test("run history is bounded and sales edits can invalidate the daily review", () => {
  const s = seed();
  for (let i = 0; i < 35; i++) runWorkflows(s, "daily-planning");
  assert.equal(s.automation?.runs.length, 30);
  const last = s.automation?.runs[0]?.id;
  s.automationProgress!.dailyDate = undefined;
  s.sales.push({ date: today(), menuId: "avo-toast", portions: 100 });
  runWorkflows(s);
  assert.notEqual(s.automation?.runs.find(r => r.workflow === "daily-planning")?.id, last);
});
