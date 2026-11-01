# Night Eats

React + TypeScript (Vite) storefront on Supabase (Google login, Postgres, Realtime), deployed on Vercel.
Customer-facing text is Gujarati. See `README.md` for setup, scripts and how the app works.

## Pull Requests
Do not add a "Generated with Claude Code" footer or attribution line to PR descriptions.

## Project layout
- `src/App.tsx`: top-level state (cart, which dialog is open, checkout gate).
- `src/components/`: UI. `CartModal` (checkout + coupon box), `AdminModal` with `OrdersTab` / `MenuTab` / `CouponsTab`, `MyOrdersModal`.
- `src/hooks/`: Supabase-backed state (`useAuth`, `useMenu`, `useOrders`, `useMyOrders`, `useShop`, `useCoupons`).
- `src/lib/`: `supabase.ts` (typed client), `database.types.ts` (**generated**, do not edit), `cart.ts`, `coupons.ts` (admin form logic), `persist.ts` (cart survives the Google redirect).
- `src/types.ts`: app types, derived from the generated database types.
- `supabase/migrations/`: the only source of truth for the schema, numbered `NNNN_name.sql`.
- `supabase/tests/database/`: pgTAP tests. `.github/workflows/ci.yml`: CI.

## Commands
- `npm run dev` / `build` / `typecheck` / `lint` / `test` (see README for the full table).
- `npm run db:start`, `db:reset`, `test:db`, `db:types` for the local Supabase stack (needs Docker).
- Before opening a PR run `npm run typecheck && npm run lint && npm test`, and `npm run test:db` if you touched SQL.
- `npx supabase ...` for anything else (`link`, `migration repair`, `db push`).

## Conventions
- **RLS on every table.** New tables enable row level security with explicit policies; revoke what clients must not have.
  Admin checks go through `public.is_admin()`.
- **No `service_role` / secret key in the frontend**, and never in a `VITE_*` variable.
- **The server is the source of truth for money.** Prices, discounts and coupons are computed in `place_order()` /
  `validate_coupon()`; the client only previews and never sends a price or a discount.
- `SECURITY DEFINER` functions set `search_path` (`public, pg_temp`) and have explicit `revoke`/`grant`.
- **Migrations:** add a new numbered file, never edit one that is live, keep old function signatures working until the new
  frontend is deployed, add a pgTAP test, run `npm run db:types` and commit the result (CI fails if it is stale).
  Migrations are applied to production by hand; deploying the site does not run them.
- Schema changes that the frontend relies on are not live until the owner applies them in Supabase.
- Dev dependencies: do not run `npm audit fix --force`; see the README section on `npm audit`.

## Working on issues
- One branch per issue (`feat/…`, `fix/…`, `chore/…`, `docs/…`) and one PR; reference the issue (`Closes #n`, or `Part of #n`
  when something is left).
- If an issue still needs something from the owner (applying a migration, a console setting, a decision), keep it open and
  give it the `Not-yet-done` label, with a comment saying exactly what is left.

## Environment notes
- The repo lives on a Windows drive and is also used from WSL. `node_modules` holds native binaries for one platform at a time
  (rollup, esbuild, supabase): after `npm install` in one environment, run `npm install` again in the other if a build fails
  with "Cannot find module @rollup/rollup-…".
