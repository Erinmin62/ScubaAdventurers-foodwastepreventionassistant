# Hourly email notification worker

This adds a separate finite Node.js command to **ExpiryGuardAI**, not a replacement app or another web server. It reads the same PostgreSQL `guard_workspace` table as the web API and writes only the new `guard_email_notifications` outbox. It never migrates workspace documents, changes inventory, runs approval executors, places orders, or depends on an open browser.

## Current verification and activation boundary

The implementation can be checked with synthetic fixtures and mocked email responses. Neither a connected email account, actual inbox delivery, nor an hourly production schedule should be considered verified by those tests. Production deployment settings and secrets are not changed by implementing the worker.

Replit's deployment inspection reported no active published deployment during implementation. Production database sharing and actual hourly execution must therefore be verified after publishing, not assumed from development results.

## Commands (from the repository root)

Build **only the worker**, without rebuilding the frontend or removing the API bundle:

```sh
pnpm --filter @workspace/api-server run email-worker:build
```

Generate a safe sample preview (no database needed, no writes, no email):

```sh
NODE_ENV=production pnpm --filter @workspace/api-server run email-worker -- --dry-run --sample
```

Preview existing database records and deduplication status (read-only, never sends):

```sh
NODE_ENV=production pnpm --filter @workspace/api-server run email-worker -- --dry-run
```

List existing workspace identifiers so a trusted administrator can configure the correct owner:

```sh
NODE_ENV=production pnpm --filter @workspace/api-server run email-worker -- --list-workspaces
```

Run one sending pass **only after** reviewing the configuration, recipients, and sample-data warning:

```sh
NODE_ENV=production pnpm --filter @workspace/api-server run email-worker -- --send
```

No flags defaults to dry-run. `--send` cannot be combined with dry-run/sample/list options. All modes exit when complete; none binds a port or starts a timer/server. A sending pass exits nonzero if a notification failed or its acceptance is uncertain. An overlapping invocation logs that it was skipped and exits successfully.

## Server-only configuration

No connected email provider was found. A Resend HTTP API adapter is prepared using Node's native `fetch`; it needs no additional package. Resend is available as a Replit integration but was not connected automatically. Connect/configure a provider before attempting real delivery. Do not paste credentials or owner addresses into chat or commit them.

| Variable | Needed for | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Database modes | Existing runtime-managed PostgreSQL connection. The published API and worker must use the **same production database**, not one development and one production database. |
| `EMAIL_NOTIFICATIONS_ENABLED` | Sending | Must be exactly `true`; otherwise sending is refused. Leave unset until ready. |
| `RESEND_API_KEY` | Sending | Resend API credential, supplied through the integration/secure Replit Secrets setup. Never frontend code. |
| `EMAIL_FROM` | Sending | Plain sender email address on a domain verified with Resend. |
| `EMAIL_WORKSPACE_RECIPIENTS_JSON` | Sending | **Secret** JSON map from existing owner workspace ID to that owner's authorised email address. This is explicit administrative opt-in, not inferred from a browser or WhatsApp preferences. |
| `EMAIL_MAX_PER_RUN` | Optional | Maximum provider attempts per run; default 100, allowed 1–500. Deferred queued items remain eligible next hour. |
| `LOG_LEVEL` | Optional | Existing structured logger setting. |
| `NODE_ENV` | Recommended | Set `production` for JSON logs in the scheduled runtime. |

Placeholder routing format (replace privately in Secrets, not source code):

```json
{"owner:user_REPLACE_ME":"owner@example.com"}
```

Only `owner:` workspace IDs are allowed for real sending. The worker must not assign the legacy shared demo to an arbitrary recipient. If routing is absent in dry-run, all stored workspaces can be inspected with a placeholder recipient hash; duplicate checks then do not represent a real configured recipient. Configure routing for an accurate recipient-specific preview.

**Existing workspaces contain synthetic samples.** Enabling email does not make those records real. Confirm the owner understands/replaces those records before opting in. Every email warns that stored data may include synthetic samples and that estimated inventory values are not realised savings.

Remove an owner from the routing map or unset `EMAIL_NOTIFICATIONS_ENABLED` to stop future attempts. Already accepted provider requests cannot be recalled. Changing an owner address is a new recipient subscription; old queued notifications are cancelled rather than sent to the former address.

## Rules and time zone

- Everything is evaluated in **Asia/Kuala_Lumpur**, using a single injected clock per observation.
- Critical: positive-quantity batches already expired or with an expiry date beginning within the next 24 hours. One alert per owner recipient + ingredient + batch + expiry date, not one per hourly execution.
- The inventory stores **date-only** expiry labels, not an exact expiry instant. For conservative alert timing the worker uses **00:00 at the start of the labelled date in Kuala Lumpur**. Thus tomorrow's date is included in critical alerts. This does not invent a precise food-safety deadline; owners still follow the label and applicable safety rules.
- Digest: batches with labels 2–3 KL calendar days away, excluding critical batches. At most one nonempty digest per recipient per KL calendar day, on that day's first eligible hourly run. Later stock changes do not send a second digest that day.
- Pending approvals: saved reorder plans with `PENDING_APPROVAL`, plus current pending preparation/purchase reviews. The worker only observes them. Identical derived reviews retain a stable semantic identifier across daily recommendation regeneration; changed quantities or a relevant recorded decision create a new review identity.
- A single reminder becomes due **24 elapsed hours after the initial email was accepted by the provider**, only if the action still requires approval. The initial acceptance time, future reminder schedule, and reminder result are persistent. A failed/uncertain initial attempt does not cause an invented reminder.
- Resolved/rejected/executed/superseded actions and cleared stock risks cancel unsent notifications. Each due event is reread immediately before attempting delivery. An owner could still act after that read, so email text always asks the owner to check the current app; it never acts on an email response.
- Invalid dates/negative or nonfinite quantities/costs are skipped and counted, never turned into fabricated monetary or food-safety advice. Derived reviews are suppressed if inventory is invalid; saved actions remain observable.

## Persistence, duplicate prevention and crash handling

The existing PostgreSQL database already supports both the published API and a scheduled process. No local files or process memory are used for production state. There is no database replacement or migration of inventory records.

The additive Drizzle schema defines `guard_email_notifications`. Each row stores:

- deterministic event ID, workspace and hashed recipient (not the recipient's raw address);
- type, event key and related ingredient/batch/action IDs;
- observed time, scheduled time and message snapshot;
- status, attempt time/count, acceptance time and provider message ID;
- sanitised error code/detail where applicable.

Both PostgreSQL event IDs and provider `Idempotency-Key` headers prevent repeats. A session-level PostgreSQL advisory lock stops overlapping worker invocations, including separate deployment processes. An atomic `queued → sending` reservation is committed before the network call.

Statuses: `queued`, `sending`, `accepted`, `failed`, `uncertain`, `cancelled`.

**Accepted is not delivered.** The `sent` log count means Resend returned a valid acceptance ID; it is not proof of inbox delivery. This implementation has no delivery/bounce webhook. Check Resend and the actual inbox for delivery evidence.

There is no way to atomically commit both a third-party email send and a database update. If a process stops after reserving a send, the next run marks it `uncertain` and **does not resend**. Timeouts, ambiguous responses and server errors are also held as uncertain. Explicit rejections are recorded as failed. Neither failed nor uncertain requests retry automatically: an administrator must inspect the provider and confirm whether a reset/retry is safe. This deliberately favours avoiding duplicate email over blindly retrying a potentially accepted request.

Resend's own idempotency records last **24 hours**, so the database ledger is retained and is the long-term duplicate guard. Do not delete ledger records to “clean up” active events or automatically retry old uncertain requests. To investigate, filter the ledger by status/time; do not expose recipient Secrets or provider request bodies.

Execution logs contain run ID, time zone, workspace/ingredient/batch/action counts, candidate counts, accepted (`sent`), skipped, failed, uncertain, cancelled and invalid-record counts. Normal logs use hashed workspace identifiers and no recipient address, API credential, raw database error, or raw provider error. `--list-workspaces` is the deliberate administrator-only exception for workspace identifiers.

## Database schema and production safety

For a new **development** database:

```sh
pnpm --filter @workspace/db run push
```

This is an additive outbox table. There is **no startup-time DDL**. Do not add schema mutations to worker/build commands, and do not run that command against production. Replit's normal Publish flow applies the development-to-production schema diff after review. Do not choose an option that overwrites production data with development samples.

Before enabling production sending:

1. Publish through Replit's standard schema review so the additive outbox exists in production.
2. Use the same project/production database as the web API. Do not copy a development connection string into production. In a separate deployment/project, explicitly arrange supported access to the existing database through secure configuration; do not provision a new empty database and assume it is shared.
3. Run a read-only worker preview and confirm the expected **production owner workspace IDs and current inventory**, not synthetic test fixtures or development accounts. Development and production Clerk accounts may have different workspace IDs.
4. Do one explicitly authorised email send to a controlled recipient and verify both the ledger receipt and inbox/provider delivery. Rerun once and confirm no duplicate.

## Replit Scheduled Deployment setup — after the worker is reviewed

Use a **separate Scheduled Deployment** for this command in the same project, alongside the existing web/API deployments. **Do not switch the website or API deployment to Scheduled**; scheduled jobs do not serve web traffic.

- Build command: `pnpm --filter @workspace/api-server run email-worker:build`
- Initial run command: `NODE_ENV=production pnpm --filter @workspace/api-server run email-worker -- --dry-run`
- Schedule: **Every hour**, or cron **`0 * * * *`**.
- Allow sufficient job time for the configured cap. With 100 attempts, a 30-minute allowance covers the approximately 26-minute worst case of repeated 15-second provider timeouts plus rate-limit pauses; normal runs exit much sooner. If using a 10-minute timeout, reduce `EMAIL_MAX_PER_RUN` to 25. The database lock also prevents overlapping jobs.
- The hourly cron expression works for KL's whole-hour UTC offset even if the scheduler displays another zone; the worker's day boundaries and digest deduplication are always explicitly KL.
- Check that the scheduled runtime receives the same production `DATABASE_URL` and the required server-only settings. A worker can run while the browser is closed because Replit, not the browser, starts the process.
- Observe a scheduled dry-run execution in deployment logs. Only after review and a successful controlled delivery test change **the worker's** run command to the same command with `--send` and enable `EMAIL_NOTIFICATIONS_ENABLED=true`.
- Keep the web/API production commands unchanged. If the UI offers only replacing an existing service, stop rather than replace it; add a separate scheduled deployment/artifact in the same project using the above command.

Do not declare hourly scheduling verified merely because a manual shell command succeeded. Verification requires at least one actual scheduled execution, and email delivery requires evidence in the actual recipient inbox/provider.

Official references:
- [Replit deployment types](https://docs.replit.com/features/publishing/deployment-types)
- [Development and production databases](https://docs.replit.com/features/data-and-storage/development-and-production)
- [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Resend send email API](https://resend.com/docs/api-reference/emails/send-email)

## Tests

```sh
pnpm run typecheck
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/api-server run test:email-worker-db
```

The final command refuses a published/production runtime. It uses uniquely named synthetic fixture rows in the **development** database, a mocked email sender, and cleans up only its own workspace/outbox rows. It verifies cross-connection persistence, duplicate guards, concurrent reservations, interrupted-send recovery and an unchanged inventory document. No real email is sent.
