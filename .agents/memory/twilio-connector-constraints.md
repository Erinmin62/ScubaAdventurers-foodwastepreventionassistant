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
