import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger";
import { seed } from "../lib/guard-model";
import { emailRoutes, providerConfig } from "../lib/email-worker/config";
import { EMAIL_TIME_ZONE, expiryEmailCandidates, scanEmailCandidates } from "../lib/email-worker/rules";
import { runEmailWorker } from "../lib/email-worker/runner";
import { resendConnectorSender, resendSender } from "../lib/email-worker/sender";

const help = `ExpiryGuardAI email worker (finite command; no web server)
  --dry-run          Read database and preview eligibility; no writes or emails (default).
  --sample           Use generated sample data instead of a database (dry-run only).
  --send             Send using configured owner routes; requires explicit enablement.
  --expiry-only      Send only critical expiry alerts and the daily 2–3 day expiry digest.
  --list-workspaces  Print workspace IDs for trusted recipient configuration; read-only.
  --help             Show this help.

See docs/email-notification-worker.md for Secrets, schema, and scheduling setup.
`;

async function main() {
  const values = process.argv.slice(2);
  // pnpm may forward its argument separator to the script; accept the documented command verbatim.
  if (values[0] === "--") values.shift();
  const args = new Set(values);
  if ([...args].some(arg => !["--dry-run", "--sample", "--send", "--expiry-only", "--list-workspaces", "--help"].includes(arg))) {
    throw new Error("unknown_worker_option");
  }
  if (args.has("--help")) { process.stdout.write(help); return; }
  const dryRun = !args.has("--send");
  if (!dryRun && (args.has("--sample") || args.has("--dry-run") || args.has("--list-workspaces"))) throw new Error("incompatible_worker_options");
  const runId = randomUUID();
  const log = (event: string, fields: Record<string, unknown>) => logger.info({ runId, ...fields }, event);
  const expiryOnly = args.has("--expiry-only");
  log("email_worker_started", { mode: dryRun ? "dry-run" : "send", expiryOnly, timeZone: EMAIL_TIME_ZONE });
  if (args.has("--sample")) {
    const rawScan = scanEmailCandidates(seed(), new Date());
    const scan = expiryOnly ? { ...rawScan, candidates: expiryEmailCandidates(rawScan.candidates) } : rawScan;
    log("email_worker_sample_completed", {
      ...scan, candidates: scan.candidates.map(row => ({ kind: row.kind, relatedIds: row.relatedIds })),
      wouldSend: scan.candidates.length, sent: 0, failed: 0, skipped: 0,
      persistentWrites: 0, deliveryVerified: false,
    });
    return;
  }
  const routes = emailRoutes(process.env);
  const config = dryRun ? undefined : providerConfig(process.env);
  const sender = !config ? undefined : config.apiKey
    ? resendSender({ ...config, apiKey: config.apiKey })
    : resendConnectorSender(config);
  if (!dryRun && !routes.length) throw new Error("owner_email_routes_required");
  const maxPerRun = Number(process.env.EMAIL_MAX_PER_RUN ?? "100");
  if (!Number.isInteger(maxPerRun) || maxPerRun < 1 || maxPerRun > 500) throw new Error("invalid_email_max_per_run");
  // Deliberately do not import the Express app, monitor, auth SDK, or any AI provider.
  const { pool } = await import("@workspace/db");
  try {
    const client = await pool.connect();
    try {
      const { postgresEmailRepository } = await import("../lib/email-worker/postgres");
      const repository = postgresEmailRepository(client);
      if (args.has("--list-workspaces")) {
        const rows = await repository.workspaces();
        for (const row of rows) log("email_worker_workspace", { workspaceId: row.id });
        return;
      }
      const result = await runEmailWorker(repository, { dryRun, routes, sender, maxPerRun, expiryOnly, log });
      if (result.failed || result.uncertain) process.exitCode = 1;
    } finally { client.release(); }
  } finally { await pool.end(); }
}
main().catch(error => {
  const allowed = new Set([
    "unknown_worker_option", "incompatible_worker_options", "invalid_recipient_configuration",
    "email_sending_disabled", "email_provider_not_configured", "owner_email_routes_required", "invalid_email_max_per_run",
  ]);
  const preflight = error instanceof Error && allowed.has(error.message);
  const sqlState = error && typeof error === "object" && "code" in error &&
    typeof error.code === "string" && /^[A-Z0-9]{5}$/.test(error.code) ? error.code : undefined;
  logger.error({
    errorCode: preflight ? error.message : sqlState === "42P01" ? "email_worker_schema_missing" : "email_worker_execution_failed",
    ...(sqlState ? { sqlState } : {}),
    detail: "No raw provider, database, credential, recipient, or connection details are logged. See the worker setup guide.",
    ...(preflight ? { sent: 0, failed: 1, skipped: 0 } : { counts: "See the preceding email_worker_aborted summary if a run started." }),
  }, "email_worker_failed");
  process.exitCode = 1;
});
