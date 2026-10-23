---
name: Email delivery guarantees
description: Why uncertain external email sends require investigation rather than automatic retries.
---

Preserve the preference for avoiding duplicate email over automatic retries when provider acceptance is unknown. Do not equate a provider acceptance receipt with actual inbox delivery.

**Why:** The requested worker must survive overlap and crashes without duplicate emails. An external send and a PostgreSQL update cannot be committed atomically, and Resend only retains its own idempotency keys for 24 hours. Retrying after an ambiguous response or interrupted commit could resend a message that already reached the owner.

**How to apply:** Investigate uncertain attempts with the provider before authorising a retry. Keep the persistent audit history. Any future retry or delivery-status feature must preserve this boundary; see `docs/email-notification-worker.md` for operational details.
