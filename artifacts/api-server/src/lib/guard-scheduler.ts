import type { Request, Response } from "express";
import { safeEqual } from "./whatsapp-cloud";

type MonitorRunner = () => Promise<boolean>;

export function createAuthenticatedSchedulerHandler(
  runMonitor: MonitorRunner,
  getSecret: () => string | undefined = () => process.env.NOTIFICATIONS_CRON_SECRET,
  reportError: (error: unknown) => void = () => {},
) {
  return async (req: Request, res: Response) => {
    const secret = getSecret();
    if (!secret) return res.sendStatus(503);
    if (!safeEqual(req.get("authorization") ?? "", `Bearer ${secret}`)) return res.sendStatus(403);

    try {
      const started = await runMonitor();
      return res.sendStatus(started ? 204 : 409);
    } catch (error) {
      reportError(error);
      return res.sendStatus(500);
    }
  };
}
