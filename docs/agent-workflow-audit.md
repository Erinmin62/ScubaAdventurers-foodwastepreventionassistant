# ExpiryGuardAI agent and action-execution audit

## Conclusion

The application has a working **human-in-the-loop, rule-based action workflow**,
not just recommendation text. It observes stock and sales, calculates a proposed
action, waits for approval, updates a simulated purchasing record, and records
the result. It can reasonably be described as a constrained rule-based agent
under the broad classical definition of an agent.

However, the inspected application does **not** call an AI inference model or
let a model select tools. No connected inference request, model SDK use, tool
registry, model-generated function arguments, or model-controlled action loop
was found in the app's execution paths. Calling it an LLM-powered or autonomous
AI agent would therefore be misleading. Installed Runpod tooling is not evidence
that the application sends inference requests to Runpod.

No chatbot, model integration, replacement architecture or new ordering feature
was needed for this audit. Existing execution was retained.

## Trace: inputs to analysis

1. `pages/inventory.tsx` and `pages/sales.tsx` in the existing web app use forms
   and parsed CSV rows with the generated `useAddGuardRecords` client hook.
2. `POST /api/guard/records` in `routes/guard.ts` validates units, quantities,
   dates and menu IDs, and adds/updates inventory or sales. Inventory includes
   measured on-hand quantity, expiry, cost and one planned incoming delivery.
3. `changeWorkspace` in `lib/guard-store.ts` locks the shared workspace row,
   applies the action inside a database transaction, validates state and
   persists the JSON document. Record changes invalidate the daily review.
4. `compute` in `lib/guard-model.ts` calculates seven-day mean sales per dish,
   with a fixed weekday factor of 0.97 or weekend factor of 1.15. Recipe amounts
   translate portions into ingredient requirements; expired ingredients cannot
   supply tomorrow's preparation. Risk levels and preparation/use-first/legacy
   purchase recommendations are produced by fixed rules and templates.
5. `analyzeReorders` in `lib/guard-reorder.ts` combines those forecasts (or an
   explicit owner-entered daily-usage assumption) with on-hand stock, expiry,
   incoming quantity/date, lead time, shelf life, minimum order and safety stock.
   It simulates safe use by earliest expiry first and calculates a replacement
   incoming quantity and explanation. The incoming delivery is not double-counted
   as stock or as a second order.

The numerical forecast is a heuristic statistical estimate, not a trained or
evaluated machine-learning model. Context-dependent output alone is not evidence
of a model call.

## Trace: action selection and execution

| Step | Existing implementation |
| --- | --- |
| Trigger | `runWorkflows` calls `scanReorders` during enabled daily planning; manual scan calls the same function. |
| Select action | Inventory-dependent rules select keep/reduce/increase/skip quantities; selection is not performed by an AI model. |
| Propose | `scanReorders` saves an immutable analysis snapshot with `PENDING_APPROVAL`, ID and input fingerprint. Scanning changes no order or stock. |
| Review | `pages/reordering.tsx` shows stock, incoming deliveries, demand, quantity/date/cost, explanation and assumptions. Owner can edit, approve or reject. |
| Validate | `POST /api/guard/reorders/:id/decision` validates the request with generated Zod schemas. `decideReorder` rechecks the fingerprint, demand availability, quantity, MOQ, integer pieces, future date, lead time and planning horizon. |
| Execute | Only approval stages a clone and commits the approved `deliveryQuantity` and `deliveryDate` to the existing ingredient's simulated purchasing plan. No actual supplier is contacted; on-hand stock is unchanged. |
| Record | The plan saves status, approver, timestamp, approved values, before/after values and explanation. Activity records the decision and execution result. |
| Prevent repeats | Terminal proposals return without executing or adding another decision log. The database row lock serializes concurrent requests. Rejected proposals cannot later execute. |
| Handle failure | A stale/invalid execution or staged executor failure cannot partially change purchasing or inventory; the failed result is retained for review. |

These are direct calls to real application functions, not model-selected tools.
The app's simulated purchase order is the ingredient's existing incoming-delivery
record, not a new supplier order entity.

## Small changes made during this audit

- Fixed the older `/guard/recommendations/:id/decision` purchase path so
  rejecting an approved revision cannot reset delivery quantity to its original
  value. Rejected legacy purchase proposals cannot subsequently execute through
  an approval retry. Other preparation and use-first behavior was not replaced.
- Added proposal IDs and explicit before/after quantity and delivery-date values
  to **all new** reorder decision activity entries, including rejection/failure.
  Existing historical log entries are preserved, not rewritten.
- Added four repeatable HTTP integration tests that exercise the actual Express
  routers and generated validation schemas. The test bundler substitutes an
  isolated transactional in-memory workspace; it cannot write to the live demo
  or production database. This models transaction serialization but is not a
  PostgreSQL-locking test.

Run all existing and new automated tests:

```sh
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/expiryguard typecheck
```

The HTTP tests cover import → scan → edited approval → simulated execution →
activity → subsequent read; concurrent approval retries; changed-payload replay;
rejection then attempted approval; malformed/below-minimum approvals; superseded
proposals; and the older purchase rejection regression. Existing deterministic
tests additionally cover insufficient/sufficient stock, FEFO, expired stock,
deliveries, missing information, lead time, MOQ, and injected execution failure.

## Verification results (2026-10-21)

- All **44 automated tests** passed (40 existing deterministic tests and four
  new HTTP integration tests). API and frontend TypeScript checks passed.
- The live browser run approved an edited coffee delivery, **1.5 → 1.1 kg** for
  2026-10-24, through the existing review form. It persisted as `EXECUTED` after
  reload; on-hand stock remained 3 kg.
- Two concurrent identical requests plus a different-quantity replay against
  that live proposal left the saved quantity and timestamp unchanged. Exactly
  one decision activity entry was present. This tested the actual database-backed
  request path, separately from the in-memory test fixture.
- A UI avocado rejection remained `REJECTED` after an approval replay; incoming
  quantity remained 3 kg and stock remained 4.5 kg.
- A below-minimum 0.1 kg chicken approval recorded `FAILED`, preserving the
  5 kg incoming order and 8 kg on-hand stock.
- The Ledger displayed all three live results with proposal IDs, timestamps and
  before/after values. A fresh Reordering screenshot rendered without application
  console errors.

These live tests left their three synthetic audit records in the demo. Coffee's
simulated incoming quantity remains 1.1 kg; no data was silently reset or deleted.

## Limits

- Approver names are self-reported in this unauthenticated shared synthetic demo.
  Server validation is not production owner authentication/authorization.
- Current inventory has one expiry batch per ingredient and one incoming delivery.
- Automated checks run while the server is active, with request-time catch-up;
  there is no guaranteed external scheduler.
- Waste/cost differences are estimates, not measured causal savings. Follow-up
  observations remain a separate existing feature; reorder approvals do not
  invent stock measurements or supplier receipts.
- No live supplier ordering or AI-model/tool-selection capability was added.
