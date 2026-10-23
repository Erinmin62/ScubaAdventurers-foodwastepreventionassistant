---
name: Forecast data readiness
description: Data boundaries and validation claims for live, synthetic, and consented owner-history forecasts.
---

The live operational forecast is a rules-based calculation from recent workspace sales and usable recipe stock. The experimental synthetic AI demo uses generated sample history. A separate experimental owner-history AI flow can use archived sales and preparation records only after the owner reviews the date/count preview and gives one-request consent; stock history and current workspace data are excluded. A local held-out check can compare workspace sales and leftover portions with baselines after explicit local approval, without sending records to AI.

**Rule:** Keep live planning, the synthetic AI demo, and the consented owner-history AI forecast clearly distinct. AI results are advisory and unvalidated; they must not change stock, approvals, plans, or orders. A local historical check is not an AI forecast and does not validate purchasing or food-safety decisions.

**Why:** Importing records for safekeeping is not AI consent. Even explicitly shared owner history does not establish forecast accuracy or trustworthy purchasing advice; held-out local scores cover only the data and measures shown.

**How to apply:** Preserve the separate synthetic demo. For owner-history AI, require a reviewed scope and explicit one-request consent, send only eligible archived sales/preparation fields, and label output advisory. Keep any accuracy or waste claims tied to local held-out evaluation and real pilot evidence; never present leftover portions as measured discarded weight or cost.

For live and backtested sales forecasts, first sum entries by menu item and calendar date, then average distinct daily totals. Base confidence on the number of distinct days, never the number of imported rows.

**Why:** One business day's sales may arrive in multiple entries. Treating each row as a separate sample overweights split days and can make a short history appear more complete than it is.

**How to apply:** Keep the grouping and distinct-day confidence rule aligned in the live forecast and its historical evaluator; preserve it with regression tests for split daily records.
