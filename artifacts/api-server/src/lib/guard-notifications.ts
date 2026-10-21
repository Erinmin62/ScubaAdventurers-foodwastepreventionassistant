import { createHash, randomBytes } from "node:crypto";
import { GetNotificationsResponse, SaveNotificationSettingsBody } from "@workspace/api-zod";
import { notificationEvents } from "./guard-notification-events";
import { type Stored } from "./guard-model";
import { InputError } from "./guard-follow-ups";
import { publicSandboxState, type SandboxStore } from "./twilio-sandbox";

export type Notifications = typeof GetNotificationsResponse._output;
type Settings = Notifications["settings"];
type Record = Notifications["records"][number];
type StoredRecord = Record & { tokenHash: string; path: string };
export type NotificationStore = {
  settings: Settings; records: StoredRecord[]; consentAt: string | null; lastScan?: string;
  events: { [key: string]: { count: number; lastAt: string; resolvedAt?: string } };
  sandbox?: SandboxStore;
};
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const defaultNotificationSettings = (): Settings => ({
  enabled: false, phone: "", optIn: false, expiry: true, recommendations: true,
  approvals: true, failures: true, completed: false, reminderHours: 24,
  maxReminders: 2, dailyLimit: 10, riskThreshold: 50,
});
export function notificationsFor(s: Stored): NotificationStore {
  return s.notifications ??= { settings: defaultNotificationSettings(), records: [], events: {}, consentAt: null };
}
export function notificationState(s: Stored): Notifications {
  const n = notificationsFor(s);
  return {
    settings: n.settings, records: n.records.map(({ tokenHash: _hash, path: _path, ...r }) => r),
    consentAt: n.consentAt, lastScan: n.lastScan, mode: "demo", liveReady: false,
    sandbox: publicSandboxState(n.sandbox),
    blockers: [
      "Production WhatsApp Business sending is not enabled. Twilio Sandbox test sending is a separate, server-configured channel.",
      "Preferences and review links are private to your signed-in workspace. Preview settings never control live Sandbox messaging.",
      "Live activation also requires an approved Meta message template, protected credentials, and a verified published HTTPS review URL.",
    ],
    monitor: "Server checks every minute while running; reminders are at least 24 hours apart. For unattended monitoring, publish on an always-running Reserved VM. Autoscale sleep and the development workspace do not guarantee scheduled execution.",
  };
}
export function saveNotificationSettings(s: Stored, input: Settings, now = new Date().toISOString()) {
  const settings = SaveNotificationSettingsBody.parse(input);
  settings.phone = settings.phone.trim();
  if (settings.phone && !/^\+[1-9]\d{7,14}$/.test(settings.phone)) throw new InputError("Use an international phone number such as +60123456789 (E.164).");
  if (settings.enabled && (!settings.optIn || !settings.phone)) throw new InputError("Enter a WhatsApp-enabled phone number and explicitly confirm opt-in before enabling notifications.");
  const n = notificationsFor(s);
  const consentChanged = settings.phone !== n.settings.phone || settings.optIn !== n.settings.optIn;
  if (consentChanged) n.consentAt = settings.optIn ? now : null;
  // An old recipient's queued work and review links must not survive a change.
  if (settings.phone !== n.settings.phone || !settings.optIn || !settings.enabled) {
    for (const r of n.records) {
      r.resolvedAt ??= now;
      if (r.status === "queued") r.status = "cancelled";
    }
    for (const e of Object.values(n.events)) e.resolvedAt ??= now;
  }
  n.settings = settings;
  s.activity.unshift({
    id: crypto.randomUUID(), time: now, title: "WhatsApp demo preferences saved",
    detail: `Monitoring ${settings.enabled ? "enabled" : "paused"}; opt-in ${settings.optIn ? "recorded" : "not given"}. No WhatsApp message sent. Phone numbers and credentials are not included in this activity entry.`,
    decision: "notification-settings", impact: 0,
  });
}
const localDay = (time: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date(time));

/** Persisted server-side outbox in demo mode; no network I/O or consequential action. */
export function scanNotificationEvents(s: Stored, now = new Date().toISOString(), force = false) {
  const n = notificationsFor(s);
  if (!force && n.lastScan && Date.parse(now) - Date.parse(n.lastScan) < 60_000) return;
  n.lastScan = now;
  if (!n.settings.enabled || !n.settings.optIn || !n.settings.phone) return;
  const events = notificationEvents(s).filter(e => n.settings[e.kind]);
  const active = new Set(events.map(e => e.id));
  for (const [id, state] of Object.entries(n.events)) if (!active.has(id)) state.resolvedAt ??= now;
  for (const r of n.records) if (!active.has(r.eventId)) r.resolvedAt ??= now;
  const day = localDay(now);
  let budget = n.settings.dailyLimit - n.records.filter(r => localDay(r.createdAt) === day && r.status !== "cancelled").length;
  const cutoff = s.notifications?.consentAt ?? now;
  let generated = 0;
  for (const event of events) {
    // Never emit historical success/failure messages on first opt-in.
    const planId = event.id.replace(/^(completed|failure):/, "");
    const plan = s.reordering?.plans.find(p => p.id === planId);
    if ((event.kind === "completed" || event.kind === "failures") && plan?.decidedAt && plan.decidedAt < cutoff) continue;
    const workflow = event.id.startsWith("workflow:") ? s.activity.find(a => `workflow:${a.id}` === event.id) : undefined;
    if (workflow && workflow.time < cutoff) continue;
    const previous = n.events[event.id];
    // Same event is not resurrected by repeatedly changing preferences.
    if (previous && (
      previous.count >= 1 + (event.remind ? n.settings.maxReminders : 0) ||
      Date.parse(now) - Date.parse(previous.lastAt) < n.settings.reminderHours * 3_600_000
    )) continue;
    if (budget <= 0) break; // Deferred events remain eligible; never mark them sent.
    const token = randomBytes(32).toString("base64url");
    const reviewUrl = `/notification-review#token=${token}`;
    const record: StoredRecord = {
      id: crypto.randomUUID(), eventId: event.id, kind: event.kind, priority: event.priority,
      title: event.title, message: `[DEMO — NOT SENT]\nExpiryGuardAI — ${event.title}\n\n${event.text}\n\nRead-only review: ${reviewUrl}`,
      createdAt: now, status: "demo", attempts: 0, reminderIndex: previous?.count ?? 0,
      recipient: `${n.settings.phone.slice(0, 3)}••••${n.settings.phone.slice(-4)}`,
      reviewUrl, expiresAt: new Date(Date.parse(now) + 48 * 3_600_000).toISOString(),
      tokenHash: hash(token), path: event.path,
    };
    n.records.unshift(record);
    n.events[event.id] = { count: (previous?.count ?? 0) + 1, lastAt: now };
    budget--; generated++;
  }
  // At most 20/day; 500 records retain every record contributing to today's cap.
  n.records = n.records.slice(0, 500);
  if (generated) s.activity.unshift({
    id: crypto.randomUUID(), time: now, title: "WhatsApp demo previews generated",
    detail: `${generated} notification previews recorded. No provider request made and no WhatsApp messages sent. No plan approved or executed.`,
    decision: "notification-demo", impact: 0,
  });
}
export function readNotificationReview(s: Stored, token: string, now = new Date().toISOString()) {
  const n = notificationsFor(s);
  const record = n.records.find(r => r.tokenHash === hash(token));
  if (!record || record.expiresAt <= now || record.resolvedAt || !n.settings.enabled || !n.settings.optIn ||
    !notificationEvents(s).some(e => e.id === record.eventId)) return null;
  return {
    title: record.title, message: record.message.split("\n\nRead-only review:")[0]!,
    expiresAt: record.expiresAt, path: record.path, demo: true,
    notice: "Read-only expiring link, available only to the signed-in workspace owner. Opening it cannot approve or execute anything. Review current data in the app before making a decision.",
  };
}
