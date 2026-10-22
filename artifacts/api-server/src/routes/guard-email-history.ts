import { Router } from "express";
import { currentWorkspaceId } from "../lib/workspace-context";
import { emailHistory } from "../lib/email-worker/delivery-postgres";

const router = Router();
router.get("/guard/email-history", async (_req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    res.json(await emailHistory(currentWorkspaceId()));
  } catch {
    res.status(503).json({ error: "Email history is unavailable. Please try again." });
  }
});
export default router;
