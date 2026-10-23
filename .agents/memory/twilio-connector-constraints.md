---
name: Twilio connector constraints
description: Why Sandbox sending uses the direct server API rather than the attached connector.
---

The Twilio connector's setup guidance at integration time supported reading
message history, but explicitly prohibited sending because its request callback
serialized bodies as JSON. Twilio message creation requires form encoding.

**Why:** Connecting Twilio alone did not provide a supported sending path. The
user supplied separate server-side Secrets so the demo could use Twilio's direct
API without exposing their personal recipient in shared settings.

**How to apply:** Recheck the current connector's documented sending capabilities
before changing providers or requesting replacement credentials. Do not assume
a connected integration supports every API operation. Keep personal Sandbox
testing separate from production WhatsApp Business sending.

In-app attention and external message delivery are separate concerns. An owner
must not need to supply a phone number or consent to WhatsApp to see inventory
risks inside the app.

**Why:** The original notification feature was a consent-gated messaging outbox.
Reusing that gate for an in-app inbox would hide food-safety risks when messaging
is disabled and could make ordinary inbox interactions trigger external sends.

**How to apply:** Keep inbox read/dismiss operations independent of messaging
preferences, delivery budgets and Sandbox consent. Label messaging-only scans
clearly; never turn opening an alert into approval or external delivery.

The owner-facing Notifications page should focus on in-app alerts, not messaging
configuration or provider diagnostics.

**Why:** The user explicitly requested removing all message settings from this
page because they confuse SME owners. This request was about the page, not
disabling or deleting the existing messaging service.

**How to apply:** Do not reintroduce WhatsApp/Sandbox setup, send controls or
preview history into the Notifications page unless the user asks for them.
