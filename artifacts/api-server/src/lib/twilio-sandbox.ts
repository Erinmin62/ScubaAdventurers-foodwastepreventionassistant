import { createHash } from "node:crypto";

const ROOT = "https://api.twilio.com/2010-04-01/Accounts";
export const SANDBOX_LIMIT = 3;
export const DAY_MS = 86_400_000;
export type SandboxConfig = { accountSid: string; authToken: string; recipient: string; sender: string; key: string };
export type SandboxAttempt = {
  id: string; fingerprint: string; createdAt: string; message: string;
  status: "sending" | "accepted" | "delivered" | "read" | "failed" | "unknown";
  providerMessageId?: string; lastError?: string;
};
export type SandboxStore = {
  key: string;
  status: "checking" | "waiting-for-opt-in" | "ready" | "window-closed" | "paused" | "error" | "daily-limit";
  notice: string; checkedAt?: string; windowExpiresAt?: string;
  consentSid?: string; commandAt?: string; commandSid?: string;
  attempts: SandboxAttempt[];
};
export type Inbound = { sid: string; at: string; body: string };
export const digest = (s: string) => createHash("sha256").update(s).digest("hex");

/** Only server Secrets supply the recipient. Public preferences cannot configure this channel. */
export function sandboxConfig(env: NodeJS.ProcessEnv = process.env): SandboxConfig | null {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const authToken = env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  const recipient = env.TWILIO_SANDBOX_RECIPIENT?.trim().replace(/^whatsapp:/, "") ?? "";
  const sender = env.TWILIO_SANDBOX_FROM?.trim().replace(/^whatsapp:/, "") || "+14155238886";
  if (!/^AC[a-f0-9]{32}$/i.test(accountSid) || !authToken || !/^\+[1-9]\d{7,14}$/.test(recipient) ||
      !/^\+[1-9]\d{7,14}$/.test(sender) || sender === recipient) return null;
  return { accountSid, authToken, recipient, sender, key: digest(`${accountSid}:${sender}:${recipient}`) };
}
export function newSandboxStore(config: SandboxConfig, attempts: SandboxAttempt[] = []): SandboxStore {
  return { key: config.key, status: "checking", notice: "Checking Twilio Sandbox membership and recipient opt-in.", attempts };
}
export const usedBudget = (s: SandboxStore | undefined, now: string) =>
  s?.attempts.filter(a => Date.parse(a.createdAt) > Date.parse(now) - DAY_MS).length ?? 0;
export function publicSandboxState(s?: SandboxStore, config = sandboxConfig(), now = new Date().toISOString()) {
  const current = config && s?.key === config.key ? s : undefined;
  const expired = current?.status === "ready" && Date.parse(current.windowExpiresAt ?? "") <= Date.parse(now);
  return {
    configured: !!config,
    status: !config ? "not-configured" as const : !current ? "checking" as const : expired ? "window-closed" as const : current.status,
    notice: !config ? "Sandbox sending is off: server-side Twilio secrets are missing or invalid."
      : !current ? "Secrets configured. The server will check the Sandbox on its next monitoring cycle."
      : expired ? "The 24-hour messaging window has closed. Message the Sandbox again to reopen it." : current.notice,
    checkedAt: current?.checkedAt, windowExpiresAt: current?.windowExpiresAt,
    dailyLimit: SANDBOX_LIMIT, usedToday: usedBudget(s, now),
    // Never expose credentials, recipient, account SID, consent message or internal dedup keys.
    messages: (s?.attempts ?? []).slice(-6).reverse().map(({ fingerprint: _fingerprint, ...a }) => a),
  };
}

function headers(c: SandboxConfig) {
  return { Authorization: `Basic ${Buffer.from(`${c.accountSid}:${c.authToken}`).toString("base64")}` };
}
const safeError = (status: number, code?: unknown) =>
  `Twilio request failed (HTTP ${status}${Number.isInteger(code) ? `, code ${code}` : ""}). Check credentials, Sandbox membership and the messaging window.`;
const messageSid = (v: unknown): v is string => typeof v === "string" && /^SM[a-f0-9]{32}$/i.test(v);

/** Query only the configured recipient, never log or return Twilio's raw response. */
export async function readSandboxInbound(c: SandboxConfig, http: typeof fetch = fetch):
  Promise<{ ok: true; messages: Inbound[] } | { ok: false; error: string }> {
  try {
    const q = new URLSearchParams({ From: `whatsapp:${c.recipient}`, To: `whatsapp:${c.sender}`, PageSize: "20" });
    const r = await http(`${ROOT}/${c.accountSid}/Messages.json?${q}`, { headers: headers(c), signal: AbortSignal.timeout(10_000) });
    const b = await r.json() as { messages?: unknown; code?: unknown };
    if (!r.ok) return { ok: false, error: safeError(r.status, b.code) };
    if (!Array.isArray(b.messages)) return { ok: false, error: "Twilio returned an invalid message history. Sending remains blocked." };
    const messages: Inbound[] = [];
    for (const m of b.messages) {
      if (m?.direction !== "inbound" || m.from !== `whatsapp:${c.recipient}` || m.to !== `whatsapp:${c.sender}` ||
          !messageSid(m.sid) || typeof m.body !== "string") continue;
      const at = Date.parse(m.date_sent ?? m.date_created);
      if (!Number.isFinite(at)) continue;
      messages.push({ sid: m.sid, at: new Date(at).toISOString(), body: m.body });
    }
    return { ok: true, messages: messages.sort((a, b) => b.at.localeCompare(a.at)) };
  } catch {
    return { ok: false, error: "Could not check Twilio message history. Sending remains blocked; the server will check again later." };
  }
}

export type SendResult = Pick<SandboxAttempt, "status" | "providerMessageId" | "lastError">;
export async function sendSandboxMessage(c: SandboxConfig, message: string, http: typeof fetch = fetch): Promise<SendResult> {
  try {
    const body = new URLSearchParams({ To: `whatsapp:${c.recipient}`, From: `whatsapp:${c.sender}`, Body: message });
    const r = await http(`${ROOT}/${c.accountSid}/Messages.json`, {
      method: "POST", headers: { ...headers(c), "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(), signal: AbortSignal.timeout(15_000),
    });
    const b = await r.json() as { sid?: unknown; code?: unknown; status?: string };
    if (!r.ok) return {
      status: r.status >= 500 ? "unknown" : "failed",
      lastError: `${safeError(r.status, b.code)} No automatic retry.`,
    };
    if (!messageSid(b.sid)) return { status: "unknown", lastError: "Twilio's response could not confirm message creation. No automatic retry." };
    return {
      status: b.status === "failed" || b.status === "undelivered" ? "failed" : "accepted",
      providerMessageId: b.sid,
      ...(b.status === "failed" || b.status === "undelivered" ? { lastError: "Twilio reported a sending failure. No automatic retry." } : {}),
    };
  } catch {
    return { status: "unknown", lastError: "Sending timed out or its result could not be confirmed. It may have sent. No automatic retry." };
  }
}
export async function pollSandboxMessage(c: SandboxConfig, sid: string, http: typeof fetch = fetch): Promise<SendResult | null> {
  if (!messageSid(sid)) return null;
  try {
    const r = await http(`${ROOT}/${c.accountSid}/Messages/${sid}.json`, { headers: headers(c), signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return null;
    const b = await r.json() as { sid?: string; status?: string; to?: string; from?: string };
    if (b.sid !== sid || b.to !== `whatsapp:${c.recipient}` || b.from !== `whatsapp:${c.sender}`) return null;
    if (b.status === "read" || b.status === "delivered") return { status: b.status };
    if (b.status === "failed" || b.status === "undelivered") return { status: "failed", lastError: "Twilio reported delivery failure. No automatic retry." };
    return null;
  } catch { return null; }
}
