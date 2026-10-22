---
name: Forecast data readiness
description: Scope and claims for AI forecasting while only synthetic sample history is available.
---

Only synthetic sample history is currently available for the café forecasting feature. The user chose a demo-only model using synthetic data.

**Rule:** Keep AI-generated forecasts visibly experimental and isolated from an owner's live workspace. Never describe them as trained on café-specific data or validated against real outcomes, and never let them change stock, approvals, or orders.

**Why:** The user has no real historical records available yet, so current model outputs cannot establish operational accuracy or trustworthy purchasing advice.

**How to apply:** Before using predictions in live decisions, add an explicit, privacy-conscious path for real historical data and evaluate forecasts on held-out actual outcomes against the existing baseline.
