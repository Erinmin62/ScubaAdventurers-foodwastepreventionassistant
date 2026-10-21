import type { MonitorHeartbeat, Stored } from "./guard-model";

export const MONITOR_STALE_AFTER_MS = 5 * 60 * 1000;
export const MONITOR_FAILURE_ALERT_AFTER_MS = 10 * 60 * 1000;

export function recordMonitorHeartbeat(s: Stored, outcome: "success" | "failure", at = new Date().toISOString()) {
  const heartbeat = s.monitorHeartbeat ??= {};
  heartbeat.lastAttemptAt = at;
  if (outcome === "success") {
    heartbeat.lastSuccessfulAt = at;
    delete heartbeat.lastFailureAt;
    delete heartbeat.failureStartedAt;
  } else {
    heartbeat.failureStartedAt ??= at;
    heartbeat.lastFailureAt = at;
  }
}

function timestamp(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value);
}

export function monitorHeartbeatState(heartbeat?: MonitorHeartbeat, now = Date.now()) {
  const lastAttemptAt = timestamp(heartbeat?.lastAttemptAt);
  const lastSuccessfulAt = timestamp(heartbeat?.lastSuccessfulAt);
  const lastFailureAt = timestamp(heartbeat?.lastFailureAt);
  const failedAt = lastFailureAt?.getTime() ?? null;
  const successAt = lastSuccessfulAt?.getTime() ?? null;

  const status = failedAt !== null && (successAt === null || failedAt >= successAt)
    ? "failed"
    : successAt === null
      ? "not-started"
      : now - successAt > MONITOR_STALE_AFTER_MS
        ? "stale"
        : "healthy";

  return { status, lastAttemptAt, lastSuccessfulAt } as const;
}
