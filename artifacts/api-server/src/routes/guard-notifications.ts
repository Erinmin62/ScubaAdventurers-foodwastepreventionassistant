import { Router } from "express";
import { GetMonitorHeartbeatStatusResponse, GetNotificationsResponse, ReviewNotificationBody, ReviewNotificationResponse, SaveNotificationSettingsBody } from "@workspace/api-zod";
import { changeWorkspace, readWorkspace } from "../lib/guard-store";
import { notificationState, notificationsFor, readNotificationReview, saveNotificationSettings, scanNotificationEvents, type Notifications } from "../lib/guard-notifications";
import { InputError } from "../lib/guard-follow-ups";
import { safeEqual, verifyWhatsAppSignature } from "../lib/whatsapp-cloud";
import { runGuardMonitor } from "../lib/guard-monitor";
import { createAuthenticatedSchedulerHandler } from "../lib/guard-scheduler";
import { inWorkspace, LEGACY_DEMO_WORKSPACE } from "../lib/workspace-context";
import { monitorHeartbeatState } from "../lib/monitor-heartbeat";

const router = Router();
router.get("/guard/monitor-status", async (_req, res): Promise<void> => {
  const workspace = await readWorkspace();
  res.json(GetMonitorHeartbeatStatusResponse.parse(monitorHeartbeatState(workspace?.monitorHeartbeat)));
});
router.get("/guard/notifications", async (_req, res) => {
  let state: Notifications | undefined;
  await changeWorkspace(s => { scanNotificationEvents(s); state = notificationState(s); }, false);
  res.json(GetNotificationsResponse.parse(state));
});
router.patch("/guard/notifications", async (req, res) => {
  const body = SaveNotificationSettingsBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Check notification preferences and numeric limits." }); return; }
  let state: Notifications | undefined;
  try {
    await changeWorkspace(s => {
      saveNotificationSettings(s, body.data);
      scanNotificationEvents(s, undefined, true);
      state = notificationState(s);
    }, false);
    res.json(GetNotificationsResponse.parse(state));
  } catch (e) {
    if (e instanceof InputError) { res.status(400).json({ error: e.message }); return; }
    throw e;
  }
});
router.post("/guard/notifications/scan", async (_req, res) => {
  let state: Notifications | undefined;
  await changeWorkspace(s => { scanNotificationEvents(s, undefined, true); state = notificationState(s); }, false);
  res.json(GetNotificationsResponse.parse(state));
});
router.post("/guard/notifications/tick", createAuthenticatedSchedulerHandler(
  runGuardMonitor,
  undefined,
  () => console.error("Authenticated scheduled monitor run failed"),
));
router.post("/guard/notifications/review", async (req, res) => {
  const input = ReviewNotificationBody.safeParse(req.body);
  if (!input.success) { res.status(410).json({ error: "This review link is invalid or expired. Open the app to review current data." }); return; }
  let result: ReturnType<typeof readNotificationReview> = null;
  await changeWorkspace(s => { result = readNotificationReview(s, input.data.token); }, false);
  if (!result) { res.status(410).json({ error: "This review link is invalid, expired or resolved. Open the app to review current data." }); return; }
  res.json(ReviewNotificationResponse.parse(result));
});
router.get("/guard/notifications/webhook", (req, res) => {
  const token = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!token || req.query["hub.mode"] !== "subscribe" || typeof req.query["hub.verify_token"] !== "string" ||
    !safeEqual(req.query["hub.verify_token"], token) || typeof req.query["hub.challenge"] !== "string") {
    res.sendStatus(403); return;
  }
  res.type("text/plain").send(req.query["hub.challenge"]);
});
router.post("/guard/notifications/webhook", async (req, res) => {
  const raw = req.body;
  const secret = process.env.WHATSAPP_APP_SECRET, phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!secret || !phoneId || !Buffer.isBuffer(raw) || !verifyWhatsAppSignature(raw, req.get("x-hub-signature-256") ?? "", secret)) {
    res.sendStatus(403); return;
  }
  let payload;
  try { payload = JSON.parse(raw.toString("utf8")); }
  catch { res.sendStatus(400); return; }
  if (payload.object !== "whatsapp_business_account") { res.sendStatus(400); return; }
  const statuses: { id: string; status: string; timestamp?: string }[] = [];
  for (const entry of Array.isArray(payload.entry) ? payload.entry : [])
    for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
      if (change?.value?.metadata?.phone_number_id !== phoneId || !Array.isArray(change.value.statuses)) continue;
      for (const status of change.value.statuses) if (typeof status?.id === "string") statuses.push(status);
    }
  await inWorkspace(LEGACY_DEMO_WORKSPACE, () => changeWorkspace(s => {
    const records = notificationsFor(s).records;
    const rank: { [key: string]: number } = { accepted: 1, delivered: 2, read: 3 };
    for (const status of statuses) {
      const record = records.find(r => r.providerMessageId === status.id && r.status !== "demo");
      if (!record) continue;
      if (status.status === "failed") {
        if (record.status === "delivered" || record.status === "read") continue;
        record.status = "failed"; record.lastError = "Provider reported delivery failure. Review recipient, template and credentials; no automatic resend.";
      } else {
        const next = status.status === "sent" ? "accepted" : status.status;
        if (!["accepted", "delivered", "read"].includes(next) || (rank[next] ?? 0) <= (rank[record.status] ?? 0)) continue;
        record.status = next as "accepted" | "delivered" | "read";
        if (next === "delivered" || next === "read") record.deliveredAt ??= new Date().toISOString();
        delete record.lastError;
      }
    }
  }, false));
  res.sendStatus(200);
});
export default router;
