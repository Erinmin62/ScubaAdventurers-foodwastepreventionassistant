# Waste-Aware Reordering demo

Open **Reordering** in ExpiryGuardAI. Everything is a shared synthetic simulation:
no supplier is contacted, no payment is made, and approval changes a planned
delivery—not physical stock.

## Quick hackathon walkthrough

1. Open **Live analysis** to show current stock, expiry, incoming delivery,
   forecast usage, potential expiry waste, and purchasing cost.
2. Open **Supplier assumptions**. Defaults are visibly synthetic: lead time
   2 days, review interval 2 days, minimum order 1 ingredient unit, safety stock
   0, delivered shelf life 5 days. Adjust these for your scenario. An optional
   daily usage override enables analysis for an ingredient without recent mapped
   menu sales. Saving an override does not make it measured demand.
3. Select **Run reorder scan**. It saves `PENDING_APPROVAL` proposals; it does
   not change any stock or delivery. Unchanged inputs do not duplicate proposals.
4. Select **Review and approve**, edit quantity/date if needed, inspect the cost
   change, enter a demo owner name, tick the review confirmation, then confirm.
   Explicitly changing a delivery date is an owner-approved reschedule.
5. Show **History**, **Pantry**, and **Ledger**: the simulated incoming quantity
   and date changed, while stock stayed the same. Refresh to demonstrate
   persistence. Reject another proposal to show that no purchase record changes.
6. To demonstrate safe failure, enter a positive quantity below its minimum
   order. The server records `FAILED`, gives a reason, and leaves delivery/stock
   unchanged. Run a fresh scan to review a new proposal.

Some original sample deliveries may now be dated today or earlier. Their receipt
is unknown: the reordering feature deliberately blocks their approval rather than
counting them as stock or silently overwriting them. Reconcile stock and delivery
dates using the Pantry batch editor and separate planned-delivery fields before continuing.

## Received batches

In **Pantry**, choose **Batches / receive** for an ingredient. Record each actual
receipt with its quantity, receipt date and expiry date. Future receipt dates are
rejected: a planned delivery is not stock. Edit a batch to correct its remaining
quantity or dates; use zero quantity for depleted/discarded stock. Entries remain
visible so their identity is retained. Current quantities are owner-reported
counts, not an automatically consumed stock ledger.

Existing workspace documents migrate inside the normal locked transaction.
Each old ingredient count becomes one stable legacy batch with its original
quantity and expiry and an **unknown** receipt date. No historical receipt or
measurement date is invented; old sales, approvals and follow-ups remain intact.
Repeated reads/reloads do not duplicate batches. Ingredient quantity is the sum
of received batches; its summary expiry is the earliest positive batch expiry.

Receipt recording/corrections never modify the planned delivery. If a receipt
corresponds to that plan, explicitly reconcile its remaining quantity/date in the
ingredient editor so the simulation does not also count it as incoming stock.
Reorder approvals still change only the planned delivery and still require owner
review. There remains one target planned delivery per ingredient, not a schedule
of multiple future orders.

Legacy inventory CSVs and ingredient edits remain supported for single-batch
stock. For multiple batches, quantity, expiry and unit cannot be replaced with an
aggregate edit/import; edit each batch instead. Other ingredient and delivery
fields remain editable. Imports are transactional: an invalid row saves nothing.
New follow-ups save immutable batch snapshots and use safe batches for usage
estimates. Aggregate outcome observations cannot overwrite multiple batch counts;
the observation is retained and directs the owner to Pantry for individual counts.

## Calculation

- The existing forecast is tomorrow's seven-day menu-sales mean with its
  weekday/weekend factor. Recipe quantities convert portions into daily
  ingredient use. Reordering repeats that rate through the planning window.
  This is a deterministic assumption, not trained/evaluated machine learning.
- Planning starts tomorrow using today's closing stock. The review horizon ends
  on delivery date + review days − 1. Missing recent sales/recipe coverage blocks
  approval unless an explicit daily usage override is supplied.
- The simulator allocates available batches by earliest expiry first. Expired
  batches cannot satisfy demand; future deliveries cannot satisfy earlier demand.
  It uses all received stock batches plus **one** separate incoming batch.
- To size the proposed delivery, simulate with the target incoming batch removed.
  Sum uncovered demand after arrival, while that delivered batch remains safe.
  Add any unmet safety-stock target at the review horizon (only when delivered
  shelf life reaches the horizon). Positive orders meet the minimum quantity;
  zero skips/cancels the planned quantity. Round upward to two decimal places,
  or whole pieces for `pcs`.
- This is the proposed **total replacement delivery**, not an additional batch.
  Additional purchasing beyond the existing incoming quantity is
  `max(0, proposed total − existing incoming)`, displayed separately.
- Warn about shortages before arrival, delivery receipt uncertainty, insufficient
  history, or shelf life shorter than the review interval. No unapproved delivery
  is delayed automatically.
- Baseline waste is simulated stock remaining at batch expiry × current unit
  cost. Compare the original and recommended delivery simulations to estimate
  potential waste reduction. Evaluate expiry through the latest relevant batch
  expiry/review date, bounded to 90 days; delivery planning is bounded to 60 days.
  Edited plans show their exact purchasing cost, but **do not claim an evaluated
  waste reduction** for the edited quantity/date.

These are inventory/planning estimates, not proof of prevented waste. Record
actual outcomes using the existing follow-up tracking. New reorder approvals
have their own decision history; they do not invent or overwrite follow-up stock
measurements.

## Safety and automation

The existing daily planning workflow now includes a reorder scan. It runs while
the API process is active and catches up on use; it is not an external scheduler
guaranteed to run during downtime. Pausing daily planning pauses automated
reordering, while the manual scan remains available.

Approval checks the saved stock/forecast/settings fingerprint, quantity minimums,
dates and lead time inside the existing row-locked database transaction.
Terminal decisions cannot execute twice or be revised via a replay. A changed
input supersedes pending proposals on the next scan. Rejections stay rejected.
Execution is staged on a clone before committing a simulated delivery update.
Failures and rejections retain unchanged before/after values when the ingredient
still exists.

Approver names are self-reported because the existing app has no authentication.
This is not a production authorization or supplier-confirmation system.

## Implementation files

- `artifacts/api-server/src/lib/guard-reorder.ts`: analysis, FEFO simulation,
  proposal snapshots, approval validation, simulated execution and audit.
- `artifacts/api-server/src/lib/guard-model.ts`: optional backward-compatible
  reordering storage in the existing workspace document.
- `artifacts/api-server/src/lib/guard-automation.ts`: daily scan integration.
- `artifacts/api-server/src/routes/guard-reorders.ts` and `routes/index.ts`:
  read, scan, configure and decision endpoints.
- `lib/api-spec/openapi.yaml`: API contract; generated API client/Zod files
  provide shared types, validation and React Query hooks.
- `artifacts/expiryguard/src/pages/reordering.tsx`: analysis, configuration,
  approval/edit/rejection, and history UI. Existing app/sidebar/Today/Automation
  files add navigation and integration text without replacing older features.
- `artifacts/api-server/src/lib/guard-reorder.test.ts`: deterministic regression
  tests. Run with `pnpm --filter @workspace/api-server test`, alongside the
  existing follow-up and automation tests.
