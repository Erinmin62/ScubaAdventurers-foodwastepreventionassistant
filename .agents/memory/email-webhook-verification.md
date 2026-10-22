---
name: Email webhook verification
description: Svix version compatibility and separating delivery evidence from send acceptance.
---

Treat Svix verification success as “did not throw”, then parse the original raw payload only after verification. Do not rely on the verifier returning parsed JSON.

**Why:** Resend's generic examples show a returned verified payload, but Svix 2.x deliberately returns void. Assuming the older return contract rejects valid, correctly signed requests. Signed HTTP regression tests must exercise the installed verifier, not mock it out.

**How to apply:** When upgrading the webhook SDK, retain exact-byte signed-request tests and check its actual verification return contract. Keep provider delivery evidence separate from immutable acceptance/uncertain send audits so it cannot accidentally release a duplicate guard.
