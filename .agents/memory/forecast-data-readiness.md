---
name: Forecast data readiness
description: Scope and claims for AI forecasting while owner imports remain in a separate historical archive.
---

The existing café forecast still uses synthetic sample history only. Owner-imported sales, preparation, leftover, and stock records are stored separately and are not current planning or AI inputs.

**Rule:** Keep AI-generated forecasts visibly experimental and isolated from an owner's live workspace. Never describe them as trained on café-specific data or validated against real outcomes, and never let them change stock, approvals, or orders. Historical archive records must not enter an AI request unless a future forecast action explicitly opts in and clearly scopes the records used.

**Why:** Importing data for safekeeping is not consent to use it for AI, and unvalidated café records cannot establish forecast accuracy or trustworthy purchasing advice.

**How to apply:** Keep the current synthetic demo unchanged. Any later café-specific forecast must have a distinct owner action, disclose which archived records are sent, and be evaluated on held-out actual outcomes against the existing baseline before operational use.
