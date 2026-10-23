# WhatsApp notifications: demo implementation and live setup

## What works now

- `/notifications`: shared-demo phone/preferences, explicit opt-in, configurable
  alert categories, reminder interval/cap, daily limit and significant-risk RM
  threshold; persistent previews/history with honest delivery statuses.
- Expiry: critical when expired/today, warning in 1–3 days, upcoming in 4–7 days.
  Notifications include measured quantity, expiry, estimated inventory/risk
  values and a safe next step. Expired food gets isolation/disposal guidance,
  never preparation or sale guidance.
- Existing prevention recommendations, pending reorder/legacy consequential
  approvals, recorded action failures/background workflow failures, and optional
  successful simulated-action confirmations. Old completion/failure history
  predating opt-in is not replayed.
- Persisted event IDs and reminders: at least 24 hours apart, default initial
  preview + two reminders, default 10/day across categories, configurable up to
  20/day. Repeated manual scans do not bypass limits. New severity is a new
  expiry event; obsolete events stop receiving reminders.
- Read-only random 256-bit review tokens, SHA-256 lookup, 48-hour expiry,
  immediate current-event checks and consent-revocation invalidation. Tokens
  travel in URL fragments and POST bodies, not query strings; the review page
  strips the fragment and uses no-referrer. No notification approves an action.
- Existing server checks run every minute independently of browser tabs.
  State/outbox is persisted in the existing row-locked workspace transaction.

**Every generated notification is currently `demo`, labelled “DEMO — NOT SENT”.
No request to WhatsApp is made by the monitor.** Attempts remain zero. UI polling
only refreshes displayed data; it is not responsible for monitoring.

The application is currently an unauthenticated shared synthetic demo. Do not
save real personal phone numbers here. Expiring links restrict access to their
read-only snapshot; they do not authenticate owners or secure the rest of the
public demo. Live sending is deliberately locked rather than allowing public
settings changes to send paid messages to arbitrary recipients.

## Official integration and live activation prerequisites

Replit's catalog offers **WhatsApp Business**
(`connector_catalog:whatsapp-business`), backed by Meta's Cloud API. It is not yet
connected. Connect it through the offered integration setup; after connecting,
use the connector's provided server runtime snippet, including its credential
refresh handling. Do not put connector tokens in frontend code.

The prepared official template transport is `src/lib/whatsapp-cloud.ts` in the
API server. It is **not wired to the demo outbox** and does not become live just
because environment variables are supplied. Before wiring a live dispatcher:

1. Establish owner-only authenticated/authorized settings and approval access
   (not self-reported names or a checkbox). Keep the shared public demo isolated.
2. Connect the official integration and select the verified WABA/sender. Confirm
   the recipient is WhatsApp-enabled and, for Meta testing, is an allowed test
   recipient. Document recipient consent to the notification categories.
3. Obtain Meta approval for the actual notification template/category and
   language. The adapter accepts a template with exactly three body text
   parameters: title, event detail, and complete expiring HTTPS review URL.
   Example body for submission:

   ```
   ExpiryGuardAI: {{1}}
   {{2}}
   Review in the app: {{3}}
   ```

   This is a proposed template, **not an approved one**. Approval/utility
   categorization is determined by Meta. Test against the approved definition,
   parameter restrictions and applicable messaging policy before sending.
4. Publish the app, obtain/verify its actual production HTTPS origin, and use
   that allowlisted origin when constructing links. There was no published URL
   at implementation time. Never substitute a guessed URL or a development
   preview URL in external provider configuration.
5. Connect the protected live outbox dispatcher to the official connector/Cloud
   transport with atomic claims, recipient opt-in revalidation, stored provider
   IDs and bounded retries. This live dispatcher is not supplied/enabled in the
   shared demo. `accepted` means Meta accepted a request, not delivered/read.
   Ambiguous network timeouts are `unknown`, not safe to resend blindly.
6. Configure the signed delivery webhook and verify actual device receipt.
   No real delivery, credentials, template approval or external webhook was
   verified during demo implementation.

For a deliberately chosen direct Cloud API setup, keep these values only in
Replit Secrets/server environment, never source, browser forms or API responses:

| Key | Purpose |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | Cloud API server access token (when not using connector-managed credentials) |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta sender phone-number ID |
| `WHATSAPP_APP_SECRET` | Meta application secret for verifying raw webhook bytes |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Random verification token configured in Meta |
| `WHATSAPP_GRAPH_VERSION` | Supported, explicitly pinned Graph API version |
| `WHATSAPP_TEMPLATE_NAME` | Actual approved three-parameter template |
| `WHATSAPP_TEMPLATE_LANGUAGE` | Approved template language, e.g. `en_US` |
| `NOTIFICATIONS_CRON_SECRET` | Optional scheduler bearer credential |

No values are prefilled or checked into this repository. Connector-managed
credentials should use its generated integration runtime instead of being
copied out manually.

### WhatsApp policy and delivery handling

Business-initiated alerts require appropriate opt-in and approved templates.
Free-form service messages are restricted to the applicable 24-hour customer
service window; this implementation never assumes such a window and the
prepared transport only sends templates. Consent withdrawal must stop sending.
Respect Meta's current template/category, quality and rate limits.

`/api/guard/notifications/webhook`:

- GET verifies `hub.mode`, verification token and challenge.
- POST uses raw bytes and validates `X-Hub-Signature-256` using the app secret.
- Only matching sender phone-number IDs and known provider message IDs update
  records. Demo previews cannot be converted into delivered messages.
- Delivery progression is monotonic; late `sent`/failed updates do not undo a
  delivered/read result. Unknown/duplicate events do not create order actions.
- Stored delivery time is server receipt time, not a claim of exact device time.

Do not configure external callbacks until a public, published HTTPS URL exists.
Meta cannot call a private/password-protected deployment without a compatible
access arrangement; signed webhook verification alone does not bypass platform
deployment privacy.

## Unattended deployment and scheduling

Recommended: publish the API on a **Reserved VM**, which stays running.
The existing server starts the checks at boot and every 60 seconds; it catches
up after downtime, subject to deduplication/limits. Development workspaces and
Autoscale instances that scale to zero cannot guarantee unattended monitoring.
This is not a guaranteed delivery SLA.

Alternative: an external scheduler can POST to the actual published URL plus
`/api/guard/notifications/tick`, with:

```
Authorization: Bearer <value of NOTIFICATIONS_CRON_SECRET>
```

Never put the credential in a URL/query string. The endpoint returns 503 if not
configured, 403 for invalid authorization, and 204 after a successful planning
and notification scan. It never approves or executes plans, and currently only
generates demo previews. Use daily or hourly scheduling as needed; reminder and
daily limits still apply. If platform deployment privacy blocks the scheduler,
configure supported external access before relying on it. Do not publish this
existing web server as a one-shot Scheduled Deployment.

Provider errors are sanitized (no raw response/token logging). The prepared
transport classifies 401/403 as requiring credential/permission review, 429/5xx
as retryable rejections, and ambiguous responses/timeouts as unknown/no blind
retry. In demo mode these cases are tested with mocked providers only.
Database outages can prevent even recording an alert; consult operational logs.

## Demo walkthrough

1. Open **Notifications**. Read the demo and live-access warnings.
2. Use a clearly synthetic test number, opt in, enable desired categories and
   save. The server creates eligible preview records from current app data.
3. Open a preview's read-only link. Review data, then follow the ordinary app
   link if a decision is needed. Nothing executes just by opening a message.
4. Scan repeatedly: unchanged events do not generate immediate duplicates.
5. Disable notifications/revoke consent: reminders stop and prior links fail.

## Code and tests

- `guard-notification-events.ts`: observes real inventory, analysis, proposals,
  approvals and operational events; never mutates purchasing.
- `guard-notifications.ts`: preferences, consent, persisted bounded history,
  event deduplication/limits and expiring read-only token lookup.
- `guard-store.ts` / `index.ts`: existing transaction/background-check integration.
- `guard-notifications.ts` router: settings/read/scan/review, protected scheduler
  endpoint, signed provider-status callbacks.
- `whatsapp-cloud.ts`: prepared official template transport, safe error
  classification and raw-body HMAC verification; not a live dispatcher.
- Frontend `notifications.tsx` / `notification-review.tsx`: settings/history and
  read-only review; existing navigation and Automations link retained.
- `guard-notifications.test.ts` and additional `guard-http.test.ts` cases:
  deterministic event/limit/link/provider tests and actual Express API boundary
  tests against an isolated transactional fixture, never the shared database.

Run `pnpm --filter @workspace/api-server test` and both app/server type checks.

### Verification completed

- **59 automated tests passed**, including the existing approval/follow-up tests,
  notification rules/limits/links, mocked Cloud API errors and signed-webhook
  handling, HTTP settings/review endpoints and protected scheduler access.
- Backend, shared-library and frontend type checks passed.
- A real-browser run saved preferences with a fictitious test number, generated
  ten clearly unsent previews, and confirmed persistence after reload.
- Repeated scans stayed at the daily limit; independent deterministic tests also
  verify deduplication below that limit and reminder intervals.
- Valid read-only links rendered, stripped their URL fragments and opened the
  normal review path without actions. Invalid/revoked tokens returned 410 and
  showed an explanatory page.
- Consent revocation stopped previews and revoked previous links. Test preferences
  were restored to enabled/opted-in demo mode; existing revoked links were not
  silently reactivated.
- Notifications, Today and Reordering rendered on a 402px viewport without page
  overflow; tested scans left stock/purchasing/decision data unchanged.
- No real Meta send, approved template, external webhook or always-running
  production schedule was tested. The browser test did not wait to independently
  observe elapsed reminder intervals or minute ticks.

References:

- https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
- https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started
- https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
- https://docs.replit.com/features/publishing/deployment-types
