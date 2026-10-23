import { pool } from "@workspace/db";
import type { DeliveryEvent } from "./delivery";

export async function saveDeliveryEvent(event: DeliveryEvent) {
  await pool.query(`INSERT INTO guard_email_delivery_events (id, provider_message_id, type, occurred_at)
    VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
  [event.id, event.providerMessageId, event.type, event.occurredAt]);
}

/** Failure/complaint evidence is never hidden by a late delivered/sent receipt.
 * Every event remains in the ledger; ordering is independent of arrival order.
 * Joins are ONLY through the worker's provider receipt, never an untrusted workspace tag.
 */
export async function emailHistory(workspaceId: string) {
  const result = await pool.query(`SELECT n.id, n.kind, n.message->>'subject' AS subject,
      n.status AS "attemptStatus", n.observed_at AS "observedAt", n.attempted_at AS "attemptedAt",
      n.accepted_at AS "acceptedAt", COALESCE(e.type, 'unconfirmed') AS "deliveryStatus",
      e.occurred_at AS "deliveryUpdatedAt"
    FROM guard_email_notifications n
    LEFT JOIN LATERAL (
      SELECT type, occurred_at FROM guard_email_delivery_events
      WHERE provider_message_id = n.provider_message_id
      ORDER BY CASE type
        WHEN 'email.complained' THEN 6 WHEN 'email.bounced' THEN 5
        WHEN 'email.failed' THEN 4 WHEN 'email.delivered' THEN 3
        WHEN 'email.delivery_delayed' THEN 2 WHEN 'email.sent' THEN 1 ELSE 0 END DESC,
        occurred_at DESC, id DESC LIMIT 1
    ) e ON true
    WHERE n.workspace_id = $1
    ORDER BY n.observed_at DESC, n.id DESC LIMIT 50`, [workspaceId]);
  return { records: result.rows };
}
