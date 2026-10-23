import { test } from "node:test";
import assert from "node:assert/strict";
import { seed, today, shift } from "./guard-model";
import { inboxState, syncInbox, updateInbox, updateInboxThresholds } from "./guard-inbox";
import { decideReorder, scanReorders } from "./guard-reorder";

const t = new Date().toISOString();
function fixture() {
  const s = seed();
  s.ingredients = [s.ingredients[0]!];
  s.automation = { dailyPlanning: false, followUpHandling: false, runs: [] };
  return s;
}
test("in-app expiry thresholds: expired/today critical, 3 warning, 7 upcoming, 8 omitted; safe text and values", () => {
  const s = fixture(), original = s.ingredients[0]!;
  s.ingredients = [-1, 0, 3, 7, 8].map(n => ({ ...original, id: `item${n}`, expiry: shift(today(), n) }));
  syncInbox(s, t);
  const items = inboxState(s).items.filter(i => i.kind === "expiry");
  assert.deepEqual(items.map(i => i.severity), ["critical", "critical", "warning", "upcoming"]);
  assert.match(items.find(i => i.relatedId === "item-1")!.description, /Do not consume, prepare or sell/);
  assert.match(items[0]!.description, /RM72.00/);
  assert.equal(inboxState(s).counts.critical, 2);
  assert.equal(inboxState(s).counts.approaching, 2);
});
test("repeated scans and JSON refresh retain stable IDs, read status and accurate unread count", () => {
  let s = fixture(); syncInbox(s, t);
  const first = inboxState(s), item = first.items.find(i => i.kind === "expiry")!;
  updateInbox(s, { action: "read", id: item.id }, t);
  s = JSON.parse(JSON.stringify(s));
  syncInbox(s, t); syncInbox(s, t);
  assert.equal(inboxState(s).items.length, first.items.length);
  assert.equal(inboxState(s).unreadCount, first.unreadCount - 1);
  assert.equal(inboxState(s).items.find(i => i.id === item.id)!.resolvedAt, null);
  assert.equal(inboxState(s).counts.approaching, 1, "reading is not resolving");
  updateInbox(s, { action: "unread", id: item.id }, t);
  assert.equal(inboxState(s).unreadCount, first.unreadCount);
});
test("inventory quantity updates the same event; empty stock resolves; expiry changes create a new event", () => {
  const s = fixture(); syncInbox(s, t);
  const i = s.ingredients[0]!, old = inboxState(s).items.find(n => n.kind === "expiry")!;
  i.quantity = 2; syncInbox(s, t);
  assert.match(inboxState(s).items.find(n => n.id === old.id)!.description, /2 kg/);
  i.quantity = 0; syncInbox(s, t);
  assert.ok(inboxState(s).items.find(n => n.id === old.id)!.resolvedAt);
  assert.equal(inboxState(s).counts.approaching, 0);
  i.quantity = 3; i.expiry = shift(today(), 1); syncInbox(s, t);
  assert.equal(inboxState(s).items.filter(n => n.kind === "expiry" && !n.resolvedAt).length, 1);
  assert.notEqual(inboxState(s).items.find(n => n.kind === "expiry" && !n.resolvedAt)!.id, old.id);
});
test("batch alerts correctly separate expired and future stock without claiming whole ingredient is expired", () => {
  const s = fixture(), i = s.ingredients[0]!;
  i.quantity = 6;
  i.batches = [{ id: "old", quantity: 1, expiry: shift(today(), -1), receivedDate: null },
    { id: "fresh", quantity: 5, expiry: shift(today(), 6), receivedDate: null }];
  syncInbox(s, t);
  const expiry = inboxState(s).items.filter(n => n.kind === "expiry");
  assert.equal(expiry.length, 2);
  assert.match(expiry.find(n => n.severity === "critical")!.description, /1 kg/);
  assert.match(expiry.find(n => n.severity === "upcoming")!.description, /5 kg/);
});
test("configured thresholds update alerts and escalation resurfaces a dismissed/read risk", () => {
  const s = fixture(); s.ingredients[0]!.expiry = shift(today(), 5); syncInbox(s, t);
  const item = inboxState(s).items.find(n => n.kind === "expiry")!;
  updateInbox(s, { action: "read", id: item.id }, t);
  updateInbox(s, { action: "dismiss", id: item.id }, t);
  updateInboxThresholds(s, { warningDays: 5, upcomingDays: 8 }, t);
  const escalated = inboxState(s).items.find(n => n.id === item.id)!;
  assert.equal(escalated.severity, "warning");
  assert.equal(escalated.readAt, null); assert.equal(escalated.dismissedAt, null);
  assert.throws(() => updateInboxThresholds(s, { warningDays: 9, upcomingDays: 8 }), /must not exceed/);
});
test("read-all, dismissal, invalid IDs cannot approve actions or hide active critical/approval conditions", () => {
  const s = fixture(); s.ingredients[0]!.expiry = today(); scanReorders(s); syncInbox(s, t);
  const before = structuredClone({ ingredients: s.ingredients, plans: s.reordering, decisions: s.decisions, activity: s.activity });
  const state = inboxState(s), critical = state.items.find(i => i.severity === "critical")!, approval = state.items.find(i => i.kind === "approvals")!;
  assert.throws(() => updateInbox(s, { action: "dismiss", id: critical.id }), /instead of dismissing/);
  assert.throws(() => updateInbox(s, { action: "dismiss", id: approval.id }), /instead of dismissing/);
  assert.throws(() => updateInbox(s, { action: "read", id: "missing" }), /not found/);
  updateInbox(s, { action: "read-all" }, t);
  assert.equal(inboxState(s).unreadCount, 0);
  assert.deepEqual({ ingredients: s.ingredients, plans: s.reordering, decisions: s.decisions, activity: s.activity }, before);
  assert.ok(inboxState(s).counts.pendingApproval > 0);
  assert.ok(inboxState(s).counts.critical > 0);
});
test("approval execution resolves pending alert, creates success and logs before/after exactly once", () => {
  const s = fixture(); scanReorders(s); syncInbox(s, t);
  const p = s.reordering!.plans.find(p => p.status === "PENDING_APPROVAL")!;
  const notice = inboxState(s).items.find(n => n.id === `approval:${p.id}`)!;
  assert.ok(notice);
  assert.match(notice.path, new RegExp(encodeURIComponent(p.id)));
  const input = { decision: "approve" as const, approver: "Test owner" };
  decideReorder(s, p.id, input); syncInbox(s, t);
  assert.equal(p.status, "EXECUTED");
  assert.ok(inboxState(s).items.find(n => n.id === notice.id)!.resolvedAt);
  assert.equal(inboxState(s).items.find(n => n.id === `completed:${p.id}`)!.severity, "success");
  const after = structuredClone(s);
  decideReorder(s, p.id, input); syncInbox(s, t);
  assert.deepEqual(s, after);
  const audit = s.activity.filter(a => a.detail.includes(`Proposal ${p.id}.`));
  assert.equal(audit.length, 1); assert.match(audit[0]!.detail, /Planned delivery: .* → /);
});
test("rejection resolves approval without executing or creating success", () => {
  const s = fixture(); scanReorders(s); syncInbox(s, t);
  const p = s.reordering!.plans.find(p => p.status === "PENDING_APPROVAL")!, before = structuredClone(s.ingredients);
  decideReorder(s, p.id, { decision: "reject", approver: "Test owner" }); syncInbox(s, t);
  assert.deepEqual(s.ingredients, before);
  assert.equal(p.status, "REJECTED");
  assert.ok(inboxState(s).items.find(n => n.id === `approval:${p.id}`)!.resolvedAt);
  assert.ok(!inboxState(s).items.some(n => n.id === `completed:${p.id}`));
  decideReorder(s, p.id, { decision: "approve", approver: "Test owner" });
  assert.deepEqual(s.ingredients, before);
});
test("stale approval produces failure notification, unchanged order and activity log", () => {
  const s = fixture(); scanReorders(s); syncInbox(s, t);
  const p = s.reordering!.plans.find(p => p.status === "PENDING_APPROVAL")!;
  s.ingredients[0]!.deliveryQuantity += 1;
  const before = structuredClone(s.ingredients);
  decideReorder(s, p.id, { decision: "approve", approver: "Test owner" }); syncInbox(s, t);
  assert.equal(p.status, "FAILED"); assert.deepEqual(s.ingredients, before);
  assert.equal(inboxState(s).items.find(n => n.id === `failure:${p.id}`)!.severity, "critical");
  assert.equal(inboxState(s).counts.failed, 1);
});
test("invalid or missing expiry/quantity is skipped safely; no NaN or invalid monetary advice", () => {
  const s = fixture(), original = s.ingredients[0]!;
  s.ingredients = [
    { ...original, id: "invalid", expiry: "2026-02-30" },
    { ...original, id: "missing", expiry: undefined as unknown as string },
    { ...original, id: "negative", quantity: -1 },
    { ...original, id: "nocost", cost: NaN },
  ];
  syncInbox(s, t);
  const items = inboxState(s).items.filter(n => n.kind === "expiry");
  assert.equal(items.length, 1); assert.equal(items[0]!.relatedId, "nocost");
  assert.ok(!items[0]!.description.includes("RM"));
  assert.ok(!inboxState(s).items.some(n => /NaN|Infinity/.test(n.description)));
});
test("critical escalation clears read state; successful replacement resolves a failed action without erasing its audit", () => {
  const s = fixture(); s.ingredients[0]!.expiry = today(); syncInbox(s, t);
  const critical = s.inbox!.items.find(i => i.kind === "expiry")!;
  critical.severity = "warning"; critical.readAt = t;
  syncInbox(s, t);
  assert.equal(critical.severity, "critical"); assert.equal(critical.readAt, null);
  scanReorders(s);
  const failed = s.reordering!.plans[0]!;
  decideReorder(s, failed.id, { decision: "approve", approver: "Test owner", quantity: -1 });
  syncInbox(s, t);
  assert.equal(inboxState(s).counts.failed, 1);
  scanReorders(s);
  const replacement = s.reordering!.plans.find(p => p.status === "PENDING_APPROVAL")!;
  decideReorder(s, replacement.id, { decision: "approve", approver: "Test owner" });
  assert.equal(replacement.status, "EXECUTED");
  syncInbox(s, t);
  assert.equal(inboxState(s).counts.failed, 0);
  assert.ok(inboxState(s).items.find(i => i.id === `failure:${failed.id}`)!.resolvedAt);
  assert.equal(s.reordering!.plans.find(p => p.id === failed.id)!.status, "FAILED");
  assert.ok(s.activity.some(a => a.decision === "failed"));
});
test("a genuinely recurring risk reopens as unread, ordinary scans do not resurface dismissed warnings", () => {
  const s = fixture(); syncInbox(s, t);
  const item = inboxState(s).items.find(n => n.kind === "expiry")!;
  updateInbox(s, { action: "dismiss", id: item.id }, t); syncInbox(s, t);
  assert.ok(inboxState(s).items.find(n => n.id === item.id)!.dismissedAt);
  s.ingredients[0]!.quantity = 0; syncInbox(s, t);
  s.ingredients[0]!.quantity = 2; syncInbox(s, t);
  const reopened = inboxState(s).items.find(n => n.id === item.id)!;
  assert.equal(reopened.resolvedAt, null); assert.equal(reopened.dismissedAt, null); assert.equal(reopened.readAt, null);
});
