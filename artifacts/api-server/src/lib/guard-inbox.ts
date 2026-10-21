import { GetInboxResponse, UpdateInboxBody, UpdateInboxThresholdsBody } from "@workspace/api-zod";
import { notificationEvents } from "./guard-notification-events";
import { daysBetween, today, type Stored } from "./guard-model";
import { stockBatches } from "./guard-batches";
import { InputError } from "./guard-follow-ups";

export type Inbox = typeof GetInboxResponse._output;
type Notice = Inbox["items"][number];
export type InboxStore = { items: Notice[]; thresholds: Inbox["thresholds"]; checkedAt: string };
const rank = { critical: 0, warning: 1, upcoming: 2, info: 3, success: 4 };
const validDate = (s: string) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
const validQuantity = (n: number) => Number.isFinite(n) && n >= 0;

function store(s: Stored): InboxStore {
  return s.inbox ??= { items: [], thresholds: { warningDays: 3, upcomingDays: 7 }, checkedAt: "" };
}

/** Independent of WhatsApp opt-in, limits and preferences. Never executes an action. */
export function syncInbox(s: Stored, now = new Date().toISOString()) {
  const inbox = store(s), day = today(), candidates: Omit<Notice, "createdAt" | "updatedAt" | "readAt" | "dismissedAt" | "resolvedAt">[] = [];
  const before = JSON.stringify(inbox.items);
  for (const i of s.ingredients) {
    for (const b of stockBatches(i)) {
      if (!validQuantity(b.quantity) || b.quantity === 0 || !validDate(b.expiry)) continue;
      const days = daysBetween(day, b.expiry);
      if (days > inbox.thresholds.upcomingDays) continue;
      const severity = days <= 0 ? "critical" : days <= inbox.thresholds.warningDays ? "warning" : "upcoming";
      const action = days < 0 ? "Isolate expired food and arrange safe disposal. Do not consume, prepare or sell it."
        : days === 0 ? "Review food-safety requirements for stock expiring today. Exclude it from tomorrow's preparation."
        : "Prioritise safe first-expiring stock in compatible recipes within expected demand and review incoming deliveries.";
      const value = validQuantity(i.cost) ? ` Estimated inventory value at risk: RM${(b.quantity * i.cost).toFixed(2)} (not realised savings).` : "";
      candidates.push({
        // Stable across quantity changes and severity escalation; a new expiry is a new event.
        id: `expiry:${i.id}:${b.id}:${b.expiry}`, kind: "expiry", severity, relatedId: i.id,
        title: `${severity === "critical" ? "Critical expiry risk" : severity === "warning" ? "Approaching expiry" : "Upcoming expiry"}: ${i.name}`,
        description: `${i.name}: ${b.quantity} ${i.unit}, batch expiry ${b.expiry} (${days < 0 ? `${-days} day${days === -1 ? "" : "s"} expired` : days === 0 ? "expires today" : `${days} days remaining`}).${value} ${action}`,
        path: `/inventory?item=${encodeURIComponent(i.id)}`,
      });
    }
  }
  // Malformed legacy stock must not break the inbox or create false expiry advice.
  const safe = { ...s, ingredients: s.ingredients.filter(i => validQuantity(i.quantity) && validQuantity(i.cost) && validDate(i.expiry) &&
    stockBatches(i).every(b => validQuantity(b.quantity) && validDate(b.expiry))) };
  for (const e of notificationEvents(safe, Date.parse(now)).filter(e => e.kind !== "expiry")) {
    // Keep the failed audit record, but stop demanding attention after a later
    // replacement for the same ingredient has actually executed successfully.
    if (e.kind === "failures" && e.id.startsWith("failure:")) {
      const failed = s.reordering?.plans.find(p => `failure:${p.id}` === e.id);
      if (failed && s.reordering?.plans.some(p => p.status === "EXECUTED" &&
        p.line.ingredientId === failed.line.ingredientId && p.createdAt >= (failed.decidedAt ?? failed.createdAt))) continue;
    }
    const relatedId = e.id.slice(e.id.indexOf(":") + 1);
    candidates.push({
      id: e.id, kind: e.kind, severity: e.kind === "completed" ? "success" : e.priority,
      title: e.title, description: e.text, relatedId,
      path: e.path === "/automation" ? e.path : `${e.path}?item=${encodeURIComponent(relatedId)}`,
    });
  }
  const active = new Set(candidates.map(c => c.id));
  for (const item of inbox.items) if (!active.has(item.id) && !item.resolvedAt) {
    item.resolvedAt = now; item.updatedAt = now;
  }
  const existing = new Map(inbox.items.map(item => [item.id, item]));
  for (const c of candidates) {
    const old = existing.get(c.id);
    if (!old) {
      inbox.items.push({ ...c, createdAt: now, updatedAt: now, readAt: null, dismissedAt: null, resolvedAt: null });
    } else {
      const resurfaced = !!old.resolvedAt || rank[c.severity] < rank[old.severity];
      if (old.description !== c.description || old.title !== c.title || old.severity !== c.severity || old.resolvedAt) {
        Object.assign(old, c, { updatedAt: now, resolvedAt: null });
      }
      // Ordinary quantity edits do not reset read status; escalation/reopened risks do.
      if (resurfaced) { old.readAt = null; old.dismissedAt = null; }
    }
  }
  // Bound historical records, retaining every active risk and pending action.
  const history = inbox.items.filter(i => i.resolvedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 300);
  inbox.items = [...inbox.items.filter(i => !i.resolvedAt), ...history];
  if (!inbox.checkedAt || before !== JSON.stringify(inbox.items) || Date.parse(now) - Date.parse(inbox.checkedAt) >= 60_000) inbox.checkedAt = now;
}

export function inboxState(s: Stored): Inbox {
  const inbox = store(s), active = inbox.items.filter(i => !i.resolvedAt);
  return GetInboxResponse.parse({
    ...inbox,
    // Critical active conditions cannot be hidden by read/dismiss settings.
    counts: {
      critical: new Set(active.filter(i => i.kind === "expiry" && i.severity === "critical").map(i => i.relatedId)).size,
      approaching: new Set(active.filter(i => i.kind === "expiry" && i.severity !== "critical").map(i => i.relatedId)).size,
      pendingApproval: active.filter(i => i.kind === "approvals").length,
      failed: active.filter(i => i.kind === "failures").length,
    },
    unreadCount: active.filter(i => !i.readAt && !i.dismissedAt).length,
    items: [...inbox.items].sort((a, b) => Number(!!a.resolvedAt) - Number(!!b.resolvedAt) ||
      rank[a.severity] - rank[b.severity] || b.updatedAt.localeCompare(a.updatedAt)),
  });
}

export function updateInbox(s: Stored, input: typeof UpdateInboxBody._output, now = new Date().toISOString()) {
  syncInbox(s, now);
  const inbox = store(s);
  if (input.action === "read-all") {
    for (const i of inbox.items) if (!i.readAt && !i.dismissedAt) i.readAt = now;
    return;
  }
  if (!input.id) throw new InputError("A notification ID is required.");
  const item = inbox.items.find(i => i.id === input.id);
  if (!item) throw new InputError("Notification not found.");
  if (input.action === "dismiss") {
    if (!item.resolvedAt && (item.severity === "critical" || item.kind === "approvals")) {
      throw new InputError("Review this critical risk or pending approval instead of dismissing it.");
    }
    item.dismissedAt ??= now;
  } else {
    item.readAt = input.action === "read" ? now : null;
    if (input.action === "unread") item.dismissedAt = null;
  }
}

export function updateInboxThresholds(s: Stored, input: typeof UpdateInboxThresholdsBody._output, now = new Date().toISOString()) {
  if (input.warningDays > input.upcomingDays) throw new InputError("Warning days must not exceed upcoming days.");
  store(s).thresholds = input;
  s.activity.unshift({ id: crypto.randomUUID(), time: now, title: "In-app alert thresholds updated",
    detail: `Warning within ${input.warningDays} days; upcoming within ${input.upcomingDays} days. Expired and expiring-today stock always remains critical. No stock or orders changed.`,
    decision: "notification-settings", impact: 0 });
  syncInbox(s, now);
}
