# Hourly email notification worker

This adds a separate finite Node.js command to **ExpiryGuardAI**, not a replacement app or another web server. It reads the same PostgreSQL `guard_workspace` table as the web API and writes only the new `guard_email_notifications` outbox plus a separate per-owner expiry-check status row. It never migrates workspace documents, changes inventory, runs approval executors, places orders, or depends on an open browser.

## Current verification and activation boundary

The worker uses the Replit-managed Resend connection through the connectors SDK when no direct `RESEND_API_KEY` is configured. A direct API key remains an optional fallback. Neither a connected email account, actual inbox delivery, nor an hourly production schedule should be considered verified by tests alone.

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

No flags defaults to dry-run. A normal `--send` pass includes critical expiry alerts, the daily 2–3 day digest, pending approval messages, and 24-hour reminders. `--expiry-only` is an optional narrower mode that excludes approval and reminder emails. `--send` cannot be combined with dry-run/sample/list options. All modes exit when complete; none binds a port or starts a timer/server. A sending pass exits nonzero if a notification failed or its acceptance is uncertain. An overlapping invocation logs that it was skipped and exits successfully.

## Owner-visible scheduled check status

Any real `--send` run records the hourly check status; dry-runs and sample previews remain read-only. The worker stores one latest status per configured owner in the separate `guard_expiry_check_status` table; it records only the completion timestamp and `success`/`failed` outcome, never inventory, recipient details, or email contents. A successful scan replaces a previous failure, so the status recovers automatically. Failed/stale states do not send additional emails or create repeated outage alerts. This heartbeat reports that the worker completed its check, not whether Resend delivered each message; individual send outcomes remain in the email history.

The signed-in Notifications page reads `GET /api/guard/expiry-check-status` using the authenticated owner's workspace context. It performs a direct database read and does not load, migrate, or write the workspace document. A missing run is shown as not started, a failed scan as failed, and a successful scan becomes overdue after 90 minutes without another success. This is a worker heartbeat, not proof that an email reached its recipient. The API remains unavailable if the status table has not yet been created during the additive schema review.

## Server-only configuration

The preferred sender uses the Resend integration attached to this Replit project; the connector keeps credentials in Replit. An optional direct `RESEND_API_KEY` selects the native HTTP fallback. Do not paste credentials or owner addresses into chat or commit them.

| Variable | Needed for | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Database modes | Existing runtime-managed PostgreSQL connection. The published API and worker must use the **same production database**, not one development and one production database. |
| `EMAIL_NOTIFICATIONS_ENABLED` | Sending | Must be exactly `true`; otherwise sending is refused. Leave unset until ready. |
| `RESEND_API_KEY` | Optional sending fallback | Direct Resend API credential. Omit when using the attached Replit Resend integration. Never frontend code. |
| `EMAIL_FROM` | Sending | Plain sender address allowed by the connected Resend account. A verified domain is needed for general recipients; Resend's onboarding sender is restricted to the account's own verified email. |
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

The additive Drizzle schema defines `guard_email_notifications` and `guard_expiry_check_status`. Each email row stores:

- deterministic event ID, workspace and hashed recipient (not the recipient's raw address);
- type, event key and related ingredient/batch/action IDs;
- observed time, scheduled time and message snapshot;
- status, attempt time/count, acceptance time and provider message ID;
- sanitised error code/detail where applicable.

Both PostgreSQL event IDs and provider `Idempotency-Key` headers prevent repeats. A session-level PostgreSQL advisory lock stops overlapping worker invocations, including separate deployment processes. An atomic `queued → sending` reservation is committed before the network call.

Statuses: `queued`, `sending`, `accepted`, `failed`, `uncertain`, `cancelled`.

**Accepted is not delivered.** The `sent` log count means Resend returned a valid acceptance ID; it is not proof of inbox delivery. The separately opt-in delivery webhook below records verified provider evidence. Resend's `email.delivered` means the recipient's mail server accepted the email, **not** that it reached the inbox or was read.

There is no way to atomically commit both a third-party email send and a database update. If a process stops after reserving a send, the next run marks it `uncertain` and **does not resend**. Timeouts, ambiguous responses and server errors are also held as uncertain. Explicit rejections are recorded as failed. Neither failed nor uncertain requests retry automatically: an administrator must inspect the provider and confirm whether a reset/retry is safe. This deliberately favours avoiding duplicate email over blindly retrying a potentially accepted request.

Resend's own idempotency records last **24 hours**, so the database ledger is retained and is the long-term duplicate guard. Do not delete ledger records to “clean up” active events or automatically retry old uncertain requests. To investigate, filter the ledger by status/time; do not expose recipient Secrets or provider request bodies.

Execution logs contain run ID, time zone, workspace/ingredient/batch/action counts, candidate counts, accepted (`sent`), skipped, failed, uncertain, cancelled and invalid-record counts. Normal logs use hashed workspace identifiers and no recipient address, API credential, raw database error, or raw provider error. `--list-workspaces` is the deliberate administrator-only exception for workspace identifiers.

## Database schema and production safety

For a new **development** database:

```sh
pnpm --filter @workspace/db run push
```

These are additive tables. There is **no startup-time DDL**. Do not add schema mutations to worker/build commands, and do not run that command against production. Replit's normal Publish flow applies the development-to-production schema diff after review. Do not choose an option that overwrites production data with development samples.

Before enabling production sending:

1. Publish through Replit's standard schema review so the additive outbox exists in production.
2. Use the same project/production database as the web API. Do not copy a development connection string into production. In a separate deployment/project, explicitly arrange supported access to the existing database through secure configuration; do not provision a new empty database and assume it is shared.
3. Run a read-only worker preview and confirm the expected **production owner workspace IDs and current inventory**, not development accounts. Development and production Clerk accounts may have different workspace IDs. If the production inventory is synthetic, enable demo emails only for an owner who explicitly chose that demonstration.
4. Do one explicitly authorised email send to a controlled recipient and verify both the ledger receipt and inbox/provider delivery. Rerun once and confirm no duplicate.

## Replit Scheduled Deployment setup — after the worker is reviewed

Use a **separate Scheduled Deployment** for this command in the same project, alongside the existing web/API deployments. **Do not switch the website or API deployment to Scheduled**; scheduled jobs do not serve web traffic.

- Build command: `pnpm --filter @workspace/api-server run email-worker:build`
- Initial run command: `NODE_ENV=production pnpm --filter @workspace/api-server run email-worker -- --dry-run`
- Schedule: **Every hour**, or cron **`0 * * * *`**.
- Allow sufficient job time for the configured cap. With 100 attempts, a 30-minute allowance covers the approximately 26-minute worst case of repeated 15-second provider timeouts plus rate-limit pauses; normal runs exit much sooner. If using a 10-minute timeout, reduce `EMAIL_MAX_PER_RUN` to 25. The database lock also prevents overlapping jobs.
- The hourly cron expression works for KL's whole-hour UTC offset even if the scheduler displays another zone; the worker's day boundaries and digest deduplication are always explicitly KL.
- Check that the scheduled runtime receives the same production `DATABASE_URL` and the required server-only settings. A worker can run while the browser is closed because Replit, not the browser, starts the process.
- Observe a scheduled dry-run execution in deployment logs. Only after confirming the intended production workspace, its inventory source, and a successful controlled delivery test, change **the worker's** run command to the same command with `--send` and enable `EMAIL_NOTIFICATIONS_ENABLED=true`. This full mode includes expiry and pending-approval notifications.
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

The final command refuses a published/production runtime. It uses uniquely named synthetic fixture rows in the **development** database, a mocked email sender, and cleans up only its own workspace/outbox/event rows. It verifies cross-connection persistence, duplicate guards, concurrent reservations, interrupted-send recovery, delivery receipt deduplication/reordering/early arrival, owner isolation and an unchanged inventory document. No real email is sent.

## Verified delivery receipts and owner history

`POST /api/webhooks/resend` accepts **raw** JSON bytes before browser authentication or JSON parsing. It uses Resend's documented **Svix Webhook.verify** method, including signature verification and the library's default timestamp/replay tolerance. It does not need a Resend API key and cannot send email.

Receiving is disabled by default. An administrator must separately opt in on the API runtime:

| Variable | Purpose |
| --- | --- |
| `EMAIL_DELIVERY_WEBHOOK_ENABLED` | Must be exactly `true` to receive receipts. Leave unset until setup is reviewed. Independent of sending opt-in. |
| `RESEND_WEBHOOK_SECRET` | Server-only endpoint signing secret from Resend, supplied privately through Secrets. This is **not** the Resend sending API key. |

After reviewing the additive `guard_email_delivery_events` schema through the normal production schema process, register the published API endpoint in Resend and subscribe to `email.sent`, `email.delivery_delayed`, `email.delivered`, `email.failed`, `email.bounced`, and `email.complained`. Obtain the actual published origin through deployment inspection; do not register the temporary development URL as production. No production activation, webhook registration, provider connection, or real send is performed by this implementation.

- The webhook stores only the verified Svix message ID, provider email ID, event type, event time, and server receipt time. It discards recipient addresses, subjects, bodies, tags and raw bounce/error details; none are logged.
- PostgreSQL's event primary key deduplicates repeat/concurrent deliveries. A successful duplicate is acknowledged. Invalid signatures, missing headers, stale/future signed request timestamps, or malformed supported events return 400 without writes. Disabled/unconfigured or failed storage returns 503 so Resend can retry. Valid unsupported event types are acknowledged without storing them.
- Receipts can arrive before the send receipt is saved. They remain unassigned until the worker's provider email ID matches; no caller-supplied owner/workspace tag is trusted. Unmatched receipts remain private and are not displayed to any owner.
- The original send audit is never overwritten by a webhook. Queued/sending/accepted/failed/uncertain/cancelled, acceptance time, attempts, errors and duplicate guards remain unchanged. An uncertain attempt without a provider ID remains unconfirmed and requires provider investigation; no guessed association and **no automatic resend**.
- History projects events deterministically, independent of arrival order: complaint > bounce > provider failure > delivery > delay > sent. Within the same type, the newest provider event time wins (event ID breaks ties). This conservative policy never hides failure or complaint evidence behind a late delivery/sent event. All receipts remain available in the database for investigation.
- The signed-in Notifications page shows the latest 50 attempts for the authenticated owner's workspace with separate attempt and delivery labels/timestamps, loading/error/empty states and manual/30-second refresh. `GET /api/guard/email-history` uses the server's owner context, not a browser-supplied workspace ID, and returns `private, no-store`. It does not load/migrate workspace data, return recipient hashes/addresses, or activate sending.
- An absent delivery event is displayed as **No verified delivery update**, never “delivered”. The history is not an email preferences screen and supplies no retry control.

Run the mocked signed HTTP checks independently with:

```sh
pnpm --filter @workspace/api-server run test:email-delivery
```

These checks are also included in the API test command. They sign synthetic payloads locally, test exact-byte verification, missing/invalid/stale/future signatures, malformed/unsupported events, disabled configuration, storage failures and authenticated workspace selection. The database checks above exercise persistent/concurrent deduplication and projection separately. They do **not** prove real provider delivery or production setup. After explicit activation, verify one controlled real email and its provider event/inbox manually before claiming operational delivery.

Provider references:
- [Resend webhook signature verification (including Svix)](https://resend.com/docs/webhooks/verify-webhooks-requests)
- [Delivered means recipient mail-server acceptance](https://resend.com/docs/webhooks/emails/delivered)
- [Bounced event](https://resend.com/docs/webhooks/emails/bounced)
