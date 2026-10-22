---
name: AI demo live checks
description: Safe verification of the synthetic AI forecast while preserving owner authentication and controlling AI usage.
---

**Rule:** Keep live AI calls explicit, synthetic-only, and inside the authenticated demo flow. Never add a public endpoint or authentication bypass to make an agent-side smoke test easier. Avoid blind retries when a provider error gives no reliable status.

**Why:** The forecast call can use Replit AI credits, and the owner asked that testing not rebuild or disrupt existing app behavior. A failed standalone check may not reveal whether the provider processed the request.

**How to apply:** Prefer the owner's signed-in forecast page for live provider verification. Use mocked provider responses for repeatable code tests; before retrying an inconclusive live call, clarify potential additional usage.
