import { Router, type IRouter } from "express";
import { GetEmailPreviewResponse } from "@workspace/api-zod";
import { compute, seed, type Stored } from "../lib/guard-model";
import { readWorkspace } from "../lib/guard-store";
import { currentWorkspaceId } from "../lib/workspace-context";
import { EMAIL_TIME_ZONE, expiryEmailPreview, klDay } from "../lib/email-worker/rules";

type WorkspaceReader = () => Promise<Stored | null>;

export function createGuardEmailPreviewRouter(read: WorkspaceReader = readWorkspace): IRouter {
  const router: IRouter = Router();
  router.get("/guard/email-preview", async (_req, res): Promise<void> => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      // A new owner's initial workspace is represented by seed() until their first
      // normal state read persists it. Previewing must not create that row.
      currentWorkspaceId();
      const now = new Date();
      const workspace = await read() ?? seed();
      const preview = expiryEmailPreview(workspace, now);
      const state = compute(workspace, klDay(now));
      res.json(GetEmailPreviewResponse.parse({
        workspaceName: state.businessProfile.name,
        synthetic: state.synthetic,
        generatedAt: now.toISOString(),
        timeZone: EMAIL_TIME_ZONE,
        ...preview,
      }));
    } catch {
      res.status(503).json({ error: "Expiry email preview is unavailable. Please try again." });
    }
  });
  return router;
}

export default createGuardEmailPreviewRouter();
