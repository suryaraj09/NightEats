# Night Eats

Online ordering for a late-night, pure-veg burger café in Vasna, Ahmedabad (delivery area: pincode 380007).
React + TypeScript (Vite) storefront on **Supabase** (Google login, Postgres, Realtime), hosted on **Vercel**.
The customer UI is in Gujarati.

- Customers browse a live menu, sign in with Google, give name + phone, and place cash-on-delivery orders.
- The owner opens the **માલિક પોર્ટલ** link in the footer to manage orders, the menu and coupons, and to open or close the shop.

## Contents

1. [Quick start (local)](#quick-start-local)
2. [Production setup](#production-setup)
3. [Environment variables](#environment-variables)
4. [Scripts](#scripts)
5. [Database and migrations](#database-and-migrations)
6. [Tests](#tests)
7. [How it works](#how-it-works)
8. [Security notes](#security-notes)
9. [Dependencies and `npm audit`](#dependencies-and-npm-audit)

## Quick start (local)

Needs Node 20+ and, for the local database, Docker.

```bash
npm install
npm run db:start        # local Supabase (Postgres + Auth + REST); prints the API URL and keys
cp .env.example .env.local
```

Put the printed **API URL** (`http://127.0.0.1:54321`) and **publishable/anon key** into `.env.local`, then:

```bash
npm run dev             # http://localhost:5173
```

`npm run db:start` applies every file in `supabase/migrations/` to a fresh database. `npm run db:reset` rebuilds it from scratch.

Local Google sign-in is not configured. To try the app without it, create a user in the local Auth API/Studio and set
a phone in `profiles`. To open the admin portal locally the user must have the owner's email **and** a Google identity row
(see `is_admin()` in `supabase/migrations/0003_security_hardening.sql`); the pgTAP tests show how to create one.

## Production setup

One-time, in this order.

1. **Supabase project**: create one at [supabase.com](https://supabase.com). Pick the region closest to customers (see issue #10).
2. **Admin email**: `supabase/migrations/0001_init.sql` seeds `admin_emails` with the owner's Gmail
   (`parikhdhairy13@gmail.com`). Change it before running if needed. That Gmail is the only admin.
3. **Schema**: run every file in `supabase/migrations/` **in numeric order** (see [migrations](#database-and-migrations)).
4. **Google OAuth** (the only sign-in method):
   1. [Google Cloud Console](https://console.cloud.google.com) → *APIs & Services → OAuth consent screen*: create an *External* app.
   2. *Credentials → Create credentials → OAuth client ID → Web application*.
      Add the **Authorized redirect URI** shown on the Supabase Google provider page
      (`https://<project-ref>.supabase.co/auth/v1/callback`).
   3. Supabase → *Authentication → Providers → Google*: enable it and paste the client ID and secret.
   4. Supabase → *Authentication → Providers → Email*: **disable** it. The admin check relies on Google-verified emails.
5. **URLs**: Supabase → *Authentication → URL Configuration*: set *Site URL* to the Vercel URL and add it plus
   `http://localhost:5173` to *Redirect URLs*.
6. **Vercel**: import the GitHub repo (framework preset *Vite*) and add the two env vars below. `vercel.json` already sets the
   build command and the SPA rewrite. Every push to `main` deploys; every PR gets a preview.

## Environment variables

| Name | Where | Value |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env.local`, Vercel | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | `.env.local`, Vercel | the `anon` / publishable key (safe in the browser; RLS protects the data) |

Never put the `service_role` / secret key in the frontend or in `VITE_*` variables: anything prefixed `VITE_` ends up in the public JavaScript.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | typecheck (`tsc -b`) then production build into `dist/` |
| `npm run typecheck` | TypeScript only |
| `npm run lint` | ESLint (react-hooks rules) |
| `npm test` | Vitest unit tests (`src/**/*.test.ts`) |
| `npm run db:start` | start local Supabase (minimal services) and apply migrations |
| `npm run db:reset` | rebuild the local database from the migrations |
| `npm run test:db` | pgTAP SQL tests in `supabase/tests/database/` (needs `db:start` first) |
| `npm run db:types` | regenerate `src/lib/database.types.ts` from the local database |
| `npm run db:types:linked` | same, from the linked remote project (`npx supabase link` first) |

CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests and build, plus a job that applies the migrations, runs the
pgTAP tests and checks that `database.types.ts` is up to date.

## Database and migrations

The schema lives only in `supabase/migrations/`, as numbered files applied in order:

| File | Adds |
| --- | --- |
| `0001_init.sql` | profiles, admin binding, menu, orders, `place_order()` |
| `0002_orders_realtime_and_shop_status.sql` | realtime for orders, shop open/closed switch |
| `0003_security_hardening.sql` | profile column grants, stricter `is_admin()`, `search_path`, order limits |
| `0004_coupons.sql` | admin-managed coupons, `validate_coupon()`, new `place_order()` |

**Adding a migration**

1. Create `supabase/migrations/NNNN_short_name.sql` (next number). Never edit a migration that is already live.
2. Every new table gets `enable row level security` and explicit policies. No policy means nobody can read it.
   Revoke anything clients must not have, and keep `security definer` functions on a fixed `search_path`.
3. `npm run db:reset` to check it applies from scratch.
4. Add or extend a test in `supabase/tests/database/`, then `npm run test:db`.
5. `npm run db:types` and commit the regenerated `src/lib/database.types.ts`.
6. Apply it to the live project **by hand**: migrations are not run by Vercel or CI. Paste the file into Supabase's
   *SQL Editor*, or use `npx supabase db push`. If earlier migrations were applied through the SQL Editor, `db push`
   does not know about them and would try to run them again; mark them first with
   `npx supabase migration repair --status applied 0001 0002 0003 ...`, or keep using the SQL Editor.
7. Deploy the frontend that needs it. Keep old function signatures working until the new frontend is live
   (`0004` does this with compatibility wrappers).

## Tests

- **Unit** (`npm test`): cart maths and the coupon form logic.
- **SQL** (`npm run test:db`): pgTAP tests of `place_order()` (pricing from the database, stock, limits, shop closed),
  row level security, the admin check, profile grants, and every coupon type and rule.
  Each test file runs in a transaction that is rolled back.

## How it works

- The menu is public (`menu_items`) and live via Supabase Realtime. Only the admin can edit it (RLS).
- Checkout requires Google login, then name + 10-digit phone (stored in `profiles`).
- Orders are created only by the `place_order(items, address, coupon_code)` SQL function. It prices items from the
  database, applies the coupon, saves the order and the app shows an in-app confirmation. Clients never send prices or discounts.
- **Coupons** (admin portal → કૂપન્સ): percent off (with cap), flat ₹ off, buy X get Y free, free item above ₹X, bundle price.
  Each can apply to the whole cart, a category or chosen items, with minimum quantity/order value, total/per-account/per-phone
  limits, first-order-only, start/end dates, weekday and time-of-day window (IST), and an on/off switch. One coupon per order.
  The cart previews the discount with `validate_coupon()`; `place_order()` enforces every rule again. `BOGO1ST` is just a
  coupon (buy 1 get 1 free, once per account and per phone). Editing or deleting a coupon never changes past orders.
  The "BOGO OFFER" banner in the header is plain text; update it if you switch `BOGO1ST` off.
- The owner sees new orders live in the Orders tab (badge and beep) and can open or close the shop; while closed,
  customers can browse but not order.

## Security notes

- Clients can only edit `name` and `phone` on their own profile (column grants) and can only create orders through `place_order()`,
  which caps cart size, limits pending/hourly orders per account and fixes the pincode.
- Admin = confirmed email in `admin_emails` **and** a linked Google identity.
- **Known accepted risk:** phone numbers are not verified (no OTP), so a per-phone coupon limit can be sidestepped with
  a second Google account and a made-up number. The per-account limit still holds. Coupon codes can also be guessed by trial
  (no attempt limit yet).
- Keep *Authentication → Providers → Email* disabled and review the auth rate limits in the Supabase dashboard.
- The old Firebase page was removed, but its API key and database URL are in git history. In the Firebase console set
  Realtime Database rules to deny all (or delete the database), then restrict or rotate the API key.

## Dependencies and `npm audit`

- Production dependencies (`react`, `react-dom`, `@supabase/supabase-js`) have **0** known vulnerabilities (`npm audit --omit=dev`).
- Remaining findings are in dev-only tooling that is never shipped or run in production: the `vercel` and `supabase` CLIs
  (transitive `tar`, `zod`, `js-yaml`, `ajv`) and ESLint (`minimatch`, `glob`). They need upstream releases; do **not** run
  `npm audit fix --force` (it downgrades the CLIs). Re-check with `npm audit` now and then.
- Install scripts are denied in `package.json` (`allowScripts`). `esbuild`'s postinstall only verifies its binary (the real binary
  comes from a platform package) and `koffi` is a CLI-only native helper; builds, tests and CI work without them.
