import { Router } from "express";
import { pool } from "@workspace/db";
import { GetExpiryCheckStatusResponse } from "@workspace/api-zod";
import { currentWorkspaceId } from "../lib/workspace-context";
import { expiryCheckStatusState } from "../lib/email-worker/expiry-check-status";

const router = Router();

router.get("/guard/expiry-check-status", async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const result = await pool.query<{ last_completed_at: Date; outcome: "success" | "failed" }>(
      `SELECT last_completed_at, outcome FROM guard_expiry_check_status WHERE workspace_id = $1`,
      [currentWorkspaceId()],
    );
    res.json(GetExpiryCheckStatusResponse.parse(expiryCheckStatusState(result.rows[0] ? {
      lastCompletedAt: result.rows[0].last_completed_at,
      outcome: result.rows[0].outcome,
    } : null)));
  } catch {
    res.status(503).json({ error: "Expiry check status is unavailable. Please try again." });
  }
});

export default router;
