import type { DatabaseClient } from "@workspace/db";
import type { EmailRecord, EmailRepository, WorkspaceRecord } from "./repository";

type Client = DatabaseClient;
type DatabaseRow = {
  id: string; workspace_id: string; recipient_hash: string; kind: EmailRecord["kind"];
  event_key: string; related_ids: string[]; scheduled_at: Date; observed_at: Date;
  status: EmailRecord["status"]; message: EmailRecord["message"]; attempts: number; accepted_at: Date | null;
};
function fromRow(row: DatabaseRow): EmailRecord {
  return {
    id: row.id, workspaceId: row.workspace_id, recipientHash: row.recipient_hash,
    kind: row.kind, eventKey: row.event_key, relatedIds: row.related_ids,
    scheduledAt: row.scheduled_at.toISOString(), observedAt: row.observed_at.toISOString(),
    status: row.status, message: row.message, attempts: row.attempts,
    acceptedAt: row.accepted_at?.toISOString(),
  };
}
// Session-level lock: use a dedicated connection until the run completes, never a pooled query.
export function postgresEmailRepository(client: Client): EmailRepository {
  return {
    async lock() {
      const result = await client.query<{ acquired: boolean }>("SELECT pg_try_advisory_lock(18471, 39012) AS acquired");
      return result.rows[0]!.acquired;
    },
    async unlock() { await client.query("SELECT pg_advisory_unlock(18471, 39012)"); },
    async recoverInterrupted() {
      const result = await client.query(`UPDATE guard_email_notifications
        SET status = 'uncertain', error_code = 'interrupted_send',
            error_detail = 'Previous worker stopped after reserving this attempt. Check provider; no automatic retry.'
        WHERE status = 'sending'`);
      return result.rowCount ?? 0;
    },
    async workspaces(ids) {
      const result = ids
        ? await client.query<WorkspaceRecord>("SELECT id, data FROM guard_workspace WHERE id = ANY($1::text[]) ORDER BY id", [ids])
        : await client.query<WorkspaceRecord>("SELECT id, data FROM guard_workspace ORDER BY id");
      return result.rows;
    },
    async workspace(id) {
      const result = await client.query<WorkspaceRecord>("SELECT id, data FROM guard_workspace WHERE id = $1", [id]);
      return result.rows[0] ?? null;
    },
    async records(workspaceId, recipientHash) {
      const result = await client.query<DatabaseRow>(`SELECT * FROM guard_email_notifications
        WHERE workspace_id = $1 AND recipient_hash = $2`, [workspaceId, recipientHash]);
      return result.rows.map(fromRow);
    },
    async enqueue(row) {
      await client.query(`INSERT INTO guard_email_notifications
        (id, workspace_id, recipient_hash, kind, event_key, related_ids, scheduled_at, observed_at, status, message, attempts)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,'queued',$9::jsonb,0)
        ON CONFLICT (id) DO UPDATE SET status = 'queued', message = EXCLUDED.message,
          related_ids = EXCLUDED.related_ids, scheduled_at = EXCLUDED.scheduled_at
        WHERE guard_email_notifications.status = 'cancelled' AND guard_email_notifications.attempts = 0`,
      [row.id, row.workspaceId, row.recipientHash, row.kind, row.eventKey,
        JSON.stringify(row.relatedIds), row.scheduledAt, row.observedAt, JSON.stringify(row.message)]);
    },
    async cancelInactive(workspaceId, recipientHash, activeIds) {
      const result = await client.query(`UPDATE guard_email_notifications SET status = 'cancelled'
        WHERE workspace_id = $1 AND status = 'queued'
          AND (recipient_hash <> $2 OR NOT (id = ANY($3::text[])))`, [workspaceId, recipientHash, activeIds]);
      return result.rowCount ?? 0;
    },
    async cancel(id) {
      await client.query("UPDATE guard_email_notifications SET status = 'cancelled' WHERE id = $1 AND status = 'queued'", [id]);
    },
    async startAttempt(id, message, at) {
      const result = await client.query(`UPDATE guard_email_notifications
        SET status = 'sending', attempts = attempts + 1, attempted_at = $2, message = $3::jsonb
        WHERE id = $1 AND status = 'queued' AND attempts = 0 RETURNING id`, [id, at, JSON.stringify(message)]);
      return result.rowCount === 1;
    },
    async finishAttempt(id, result, at) {
      const changed = await client.query(`UPDATE guard_email_notifications SET status = $2,
        accepted_at = $3, provider_message_id = $4, error_code = $5, error_detail = $6
        WHERE id = $1 AND status = 'sending' RETURNING id`, [
        id, result.status, result.status === "accepted" ? at : null,
        result.status === "accepted" ? result.providerId : null,
        result.status === "accepted" ? null : result.errorCode,
        result.status === "accepted" ? null : result.errorDetail,
      ]);
      if (changed.rowCount !== 1) throw new Error("email_attempt_not_recorded");
    },
  };
}
