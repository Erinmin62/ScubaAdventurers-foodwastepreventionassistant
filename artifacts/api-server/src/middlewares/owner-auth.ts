import { getAuth } from "@clerk/express";
import type { Request, RequestHandler } from "express";
import { inWorkspace, ownerWorkspaceId } from "../lib/workspace-context";
import { getClerkProxyHost } from "./clerkProxyMiddleware";

// Exact machine endpoints have their own signature / cron-secret validation.
// No other route, including token review links, is public.
export function createOwnerAuth(identity: (req: Request) => string | null = req => getAuth(req).userId): RequestHandler {
  return (req, res, next) => {
  if (
    (req.path === "/notifications/tick" && req.method === "POST") ||
    (req.path === "/notifications/webhook" && ["GET", "POST"].includes(req.method))
  ) { next(); return; }
  res.setHeader("Cache-Control", "private, no-store");
  const userId = identity(req);
  if (!userId) { res.status(401).json({ error: "Sign in to access your private business workspace." }); return; }
  // Reject browser cross-origin writes even when a session cookie is present.
  const site = req.get("sec-fetch-site");
  const origin = req.get("origin");
  let foreignOrigin = false;
  if (origin) {
    try { foreignOrigin = new URL(origin).host !== getClerkProxyHost(req); }
    catch { foreignOrigin = true; }
  }
  if (site === "cross-site" || foreignOrigin) {
    res.status(403).json({ error: "Cross-site workspace requests are not allowed." }); return;
  }
  inWorkspace(ownerWorkspaceId(userId), next);
  };
}
export const ownerAuth = createOwnerAuth();
