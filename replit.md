# ExpiryGuardAI

Food-waste prevention assistant for café and restaurant owners using realistic synthetic sales, inventory, and result records.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-server test` — follow-up snapshot, calendar, outcome and inventory-safety regression tests
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

- Automation is limited to daily planning reviews and follow-up scheduling/reminders. Unattended production checks require the Reserved VM deployment target; the minute monitor and authenticated `/api/guard/notifications/tick` share a single-flight runner. External schedulers must set `NOTIFICATIONS_CRON_SECRET` and send it as a bearer token. The workspace development process only runs while active.
- Pausing automation never disables live expiry checks or deletes existing follow-ups. Automation never approves plans, places orders, or invents measured stock/waste records.

- Clerk sign-in is required for café data. Each owner has a separate workspace seeded with synthetic samples; legacy shared demo data is never assigned to a new account. Only trusted server jobs may enter the legacy demo workspace. Twilio Sandbox remains confined to legacy synthetic data and its server-configured recipient, never owner records or browser preferences.
- Forecasts are transparent rules-based estimates, not an external LLM or a trained ML model.
- All purchasing and preparation recommendations require human approval. Never place supplier orders automatically or suggest using expired ingredients.
- Monetary values use Malaysian ringgit (RM), and planning dates use Asia/Kuala_Lumpur.

## Product

Sales and inventory input/CSV import, tomorrow's menu forecasts, safe-stock capacity checks, expiry and overstock risks, editable preparation/purchasing approvals, actual sales and leftover tracking, waste/cost comparisons, and persistent activity history. Approvals schedule one- or two-day follow-ups (default two), with immutable ingredient-level snapshots and owner-reported remaining stock, ingredient discards, and action taken. Follow-ups are retained independently of regenerated recommendations in the persistent workspace document.

## User preferences

Use synthetic data. The user requested cute Genshin Impact-like characters while keeping practical business controls. Every recommendation must support approve, edit, and reject, with decision and estimated purchasing impact recorded.

## Gotchas

- Waste-aware reordering uses all received expiry batches but updates only the single simulated incoming delivery after explicit approval; it never changes on-hand stock or places supplier orders. Supplier terms and delivered shelf life are editable assumptions, not verified data.
- See `docs/waste-aware-reordering.md` for calculations, safeguards, test commands and the hackathon walkthrough. Daily planning includes reorder drafts; future order dates/receipt uncertainties require owner reconciliation.

- Follow-up forecasts exclude unconfirmed deliveries and are not a stock ledger. Comparisons do not establish consumption or causal waste reduction. Ingredient discards are not added to prepared-food leftover totals.
- Old documents have no follow-ups or known inventory measurement dates by default. Attach checks explicitly with a current snapshot; never invent historical approval times or stock.
- Inventory writes from outcomes require explicit confirmation. Historical observations do not overwrite unknown, same-day, or newer measurements. Inventory forms/imports date current measurements using the Kuala Lumpur planning day.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
