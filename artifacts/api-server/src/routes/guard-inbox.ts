import { Router } from "express";
import { GetInboxResponse, UpdateInboxBody, UpdateInboxThresholdsBody } from "@workspace/api-zod";
import { changeWorkspace } from "../lib/guard-store";
import { inboxState, syncInbox, updateInbox, updateInboxThresholds, type Inbox } from "../lib/guard-inbox";
import { InputError } from "../lib/guard-follow-ups";

const router = Router();
router.get("/guard/inbox", async (_req, res) => {
  let result: Inbox | undefined;
  await changeWorkspace(s => { syncInbox(s); result = inboxState(s); }, false);
  res.json(GetInboxResponse.parse(result));
});
router.post("/guard/inbox/update", async (req, res) => {
  const input = UpdateInboxBody.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Invalid notification update." }); return; }
  let result: Inbox | undefined;
  try {
    await changeWorkspace(s => { updateInbox(s, input.data); result = inboxState(s); }, false);
    res.json(GetInboxResponse.parse(result));
  } catch (e) {
    if (e instanceof InputError) { res.status(e.message === "Notification not found." ? 404 : 400).json({ error: e.message }); return; }
    throw e;
  }
});
router.patch("/guard/inbox/thresholds", async (req, res) => {
  const input = UpdateInboxThresholdsBody.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Warning must be 1–30 days and upcoming must be 1–90 days." }); return; }
  let result: Inbox | undefined;
  try {
    await changeWorkspace(s => { updateInboxThresholds(s, input.data); result = inboxState(s); }, false);
    res.json(GetInboxResponse.parse(result));
  } catch (e) {
    if (e instanceof InputError) { res.status(400).json({ error: e.message }); return; }
    throw e;
  }
});
export default router;
