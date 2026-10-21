import { randomUUID } from "node:crypto";
import type { Stored } from "./guard-model";
import { notificationsFor } from "./guard-notifications";
import { notificationEvents } from "./guard-notification-events";
import {
  DAY_MS, SANDBOX_LIMIT, digest, newSandboxStore, pollSandboxMessage, readSandboxInbound,
  sandboxConfig, sendSandboxMessage, usedBudget,
  type SandboxAttempt, type SandboxConfig, type SandboxStore,
} from "./twilio-sandbox";

type Mutate = (action: (s: Stored) => void, autoRun?: boolean) => Promise<unknown>;
const cleanCommand = (text: string) => text.trim().replace(/\s+/g, " ").toUpperCase();
const starts = (text: string) => cleanCommand(text) === "START EXPIRYGUARDAI DEMO";
const pauses = (text: string) => ["PAUSE EXPIRYGUARDAI DEMO", "STOP EXPIRYGUARDAI DEMO", "STOP"].includes(cleanCommand(text));
const localDay = (now: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date(now));
function store(s: Stored, c: SandboxConfig) {
  const n = notificationsFor(s);
  if (n.sandbox?.key !== c.key) n.sandbox = newSandboxStore(c, n.sandbox?.attempts ?? []);
  return n.sandbox;
}
function log(s: Stored, now: string, title: string, detail: string) {
  s.activity.unshift({ id: randomUUID(), time: now, title, detail, decision: "notification-sandbox", impact: 0 });
}

/**
 * Server-only monitor: no public route invokes it and shared preview settings cannot enable it.
 * A persisted reservation precedes the POST. Ambiguous sends are never automatically retried.
 */
export async function runTwilioSandbox({
  mutate, config = sandboxConfig(), http = fetch, now = new Date().toISOString(),
}: { mutate: Mutate; config?: SandboxConfig | null; http?: typeof fetch; now?: string }) {
  if (!config) return;
  const c = config;
  const inbound = await readSandboxInbound(c, http);
  let claim: SandboxAttempt | undefined;
  let polling: SandboxAttempt[] = [];
  await mutate(s => {
    const n = store(s, c);
    n.checkedAt = now;
    // A process that died after reservation may have sent. Do not resubmit that attempt.
    for (const a of n.attempts)
      if (a.status === "sending" && Date.parse(now) - Date.parse(a.createdAt) >= 120_000) {
        a.status = "unknown"; a.lastError = "The server stopped before confirming this send. It may have sent. No automatic retry.";
      }
    polling = n.attempts.filter(a => a.status === "accepted" && a.providerMessageId && Date.parse(now) - Date.parse(a.createdAt) < 2 * DAY_MS);
    if (!inbound.ok) { n.status = "error"; n.notice = inbound.error; return; }
    const recent = inbound.messages.filter(m => Date.parse(m.at) <= Date.parse(now) + 60_000 && Date.parse(now) - Date.parse(m.at) < DAY_MS);
    const command = recent.find(m => starts(m.body) || pauses(m.body));
    if (command && command.sid !== n.commandSid && (!n.commandAt || command.at >= n.commandAt)) {
      n.commandSid = command.sid; n.commandAt = command.at;
      n.consentSid = starts(command.body) ? command.sid : undefined;
      log(s, now, starts(command.body) ? "WhatsApp Sandbox opt-in verified" : "WhatsApp Sandbox paused",
        "A command from the server-configured recipient was verified through Twilio. No phone number or credentials are recorded here.");
    }
    if (!n.consentSid) {
      n.status = n.commandSid ? "paused" : "waiting-for-opt-in";
      n.notice = n.commandSid
        ? "Sandbox paused by the recipient. Send START EXPIRYGUARDAI DEMO to opt in again."
        : "Join your Twilio Sandbox, then send START EXPIRYGUARDAI DEMO from the recipient phone. No message will be sent before this is verified.";
      return;
    }
    if (!recent.length) {
      n.status = "window-closed"; n.notice = "The 24-hour messaging window has closed. Message your Sandbox again to reopen it."; return;
    }
    n.windowExpiresAt = new Date(Date.parse(recent[0]!.at) + DAY_MS).toISOString();
    // Leave a safety margin rather than attempting a send at the window boundary.
    if (Date.parse(n.windowExpiresAt) - Date.parse(now) < 60_000) {
      n.status = "window-closed"; n.notice = "The messaging window is closing. Message the Sandbox again before the next test."; return;
    }
    if (usedBudget(n, now) >= SANDBOX_LIMIT) {
      n.status = "daily-limit"; n.notice = "Sandbox safety cap reached: 3 attempts per rolling 24 hours, including failed or uncertain attempts."; return;
    }
    n.status = "ready"; n.notice = "Opt-in verified. Real test alerts may be sent to the single recipient stored in server Secrets; demo settings below do not control this channel.";
    const events = notificationEvents(s).filter(e => !["completed", "failures"].includes(e.kind));
    const priority = { critical: 0, warning: 1, upcoming: 2, info: 3 };
    events.sort((a, b) => priority[a.priority] - priority[b.priority] || a.id.localeCompare(b.id));
    const fingerprint = digest(`${c.key}:${n.consentSid}:${localDay(now)}:${events.map(e => e.id).sort().join("|")}`);
    if (n.attempts.some(a => a.fingerprint === fingerprint)) return;
    // Also bound distinct alert digests to one per five minutes.
    if (n.attempts.some(a => Date.parse(now) - Date.parse(a.createdAt) < 300_000)) {
      n.notice = "Waiting for the five-minute gap between Sandbox test messages."; return;
    }
    const highlights = events.slice(0, 3).map(e => `${e.title}\n${e.text.slice(0, 310)}`).join("\n\n") || "No current expiry or approval alerts. Your test notification connection is working.";
    claim = {
      id: randomUUID(), fingerprint, createdAt: now, status: "sending",
      message: `ExpiryGuardAI — SANDBOX TEST\nSynthetic café data; financial values are estimates, not realised savings.\n\n${highlights}\n\n${events.length > 3 ? `${events.length} current alerts; showing the first 3. ` : ""}Review details in the app. No plan is approved and no order is placed by this message.\nTo pause: reply PAUSE EXPIRYGUARDAI DEMO.`,
    };
    n.attempts.push(claim);
    n.attempts = n.attempts.slice(-100);
    log(s, now, "WhatsApp Sandbox send reserved", "One bounded synthetic-data alert was reserved for the configured recipient. Duplicate and uncertain sends will not be retried automatically.");
  }, false);
  if (claim) {
    const result = await sendSandboxMessage(c, claim.message, http);
    await mutate(s => {
      const n = store(s, c), a = n.attempts.find(a => a.id === claim!.id);
      if (!a) return;
      Object.assign(a, result);
      if (result.status === "failed" || result.status === "unknown") {
        n.status = "error"; n.notice = result.lastError ?? "Sending was not confirmed. No automatic retry.";
      }
      log(s, now, `WhatsApp Sandbox send: ${result.status}`,
        result.status === "accepted" ? "Twilio accepted the test message; delivery is not yet confirmed. No plan or purchasing action was executed."
          : "Sending failed or could not be confirmed. No automatic retry and no application action was executed.");
    }, false);
  }
  for (const p of polling) {
    const result = await pollSandboxMessage(c, p.providerMessageId!, http);
    if (!result) continue;
    await mutate(s => {
      const a = store(s, c).attempts.find(a => a.id === p.id);
      if (!a || a.status === result.status || a.status === "read" || a.status === "failed") return;
      Object.assign(a, result);
      log(s, now, `WhatsApp Sandbox delivery: ${result.status}`, "Twilio's message status was checked. No phone number, credentials or raw provider response are included in this log.");
    }, false);
  }
}
