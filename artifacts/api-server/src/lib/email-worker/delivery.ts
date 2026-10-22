import { Webhook } from "svix";
import { z } from "zod";
import type { RequestHandler } from "express";

export const deliveryTypes = [
  "email.sent", "email.delivery_delayed", "email.delivered",
  "email.failed", "email.bounced", "email.complained",
] as const;
export type DeliveryEvent = { id: string; providerMessageId: string; type: typeof deliveryTypes[number]; occurredAt: string };
const envelope = z.object({ type: z.string() });
const receipt = z.object({
  type: z.enum(deliveryTypes),
  created_at: z.string().datetime({ offset: true }),
  data: z.object({ email_id: z.string().min(1).max(200) }),
});

/** Svix is Resend's documented verifier; it enforces signature and timestamp tolerance.
 * Configuration is read at request time. No provider API credential or send path is needed.
 */
export function createDeliveryWebhook(
  save: (event: DeliveryEvent) => Promise<void>,
  config: () => { enabled: boolean; secret?: string } = () => ({
    enabled: process.env.EMAIL_DELIVERY_WEBHOOK_ENABLED === "true",
    secret: process.env.RESEND_WEBHOOK_SECRET,
  }),
): RequestHandler {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const { enabled, secret } = config();
    if (!enabled || !secret) {
      res.status(503).json({ error: "Email delivery webhook is not enabled." }); return;
    }
    const id = req.get("svix-id");
    const timestamp = req.get("svix-timestamp");
    const signature = req.get("svix-signature");
    if (!Buffer.isBuffer(req.body) || !id || id.length > 200 || !timestamp || !signature) {
      res.status(400).json({ error: "Invalid webhook." }); return;
    }
    let payload: unknown;
    try {
      const raw = req.body.toString("utf8");
      new Webhook(secret).verify(raw, {
        "svix-id": id, "svix-timestamp": timestamp, "svix-signature": signature,
      });
      // Svix 2.x verifies by throwing on failure; it does not return parsed JSON.
      payload = JSON.parse(raw);
    } catch {
      res.status(400).json({ error: "Invalid webhook." }); return;
    }
    const kind = envelope.safeParse(payload);
    if (!kind.success) { res.status(400).json({ error: "Invalid event." }); return; }
    // Acknowledge unsupported, signed event types without retaining payloads or PII.
    if (!deliveryTypes.includes(kind.data.type as DeliveryEvent["type"])) {
      res.json({ received: true }); return;
    }
    const parsed = receipt.safeParse(payload);
    if (!parsed.success) { res.status(400).json({ error: "Invalid event." }); return; }
    try {
      await save({ id, providerMessageId: parsed.data.data.email_id, type: parsed.data.type, occurredAt: parsed.data.created_at });
      res.json({ received: true });
    } catch {
      // Non-2xx asks Resend to retry. Never log signatures, payloads, or database errors.
      res.status(503).json({ error: "Delivery receipt could not be saved." });
    }
  };
}
