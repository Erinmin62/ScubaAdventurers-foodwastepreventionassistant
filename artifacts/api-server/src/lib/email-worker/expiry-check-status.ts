export const EXPIRY_CHECK_STALE_AFTER_MS = 90 * 60 * 1000;

export type StoredExpiryCheckStatus = {
  lastCompletedAt: string | Date;
  outcome: "success" | "failed";
} | null;

export function expiryCheckStatusState(record: StoredExpiryCheckStatus, now = Date.now()) {
  const raw = record?.lastCompletedAt;
  const parsed = raw instanceof Date ? raw : raw ? new Date(raw) : null;
  const lastCompletedAt = parsed && Number.isFinite(parsed.getTime()) ? parsed : null;
  const outcome = lastCompletedAt && record ? record.outcome : null;
  const status = outcome === "failed"
    ? "failed"
    : !lastCompletedAt
      ? "not-started"
      : now - lastCompletedAt.getTime() > EXPIRY_CHECK_STALE_AFTER_MS
        ? "stale"
        : "healthy";
  return { status, lastCompletedAt, outcome } as const;
}
