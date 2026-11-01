# Night Eats

React + TypeScript (Vite) storefront, Supabase (Auth + Postgres + Realtime), hosted on Vercel.
The original single-file Firebase page was removed (it remains in git history).

## One-time setup

1. **Supabase project** → create one at supabase.com.
2. **Schema** → `supabase/migrations/0001_init.sql` seeds `admin_emails` with the owner's Gmail
   (`parikhdhairy13@gmail.com`; change it in the file before running if needed), then run it in
   *SQL Editor* or with `npx supabase db push`. That Gmail is the only admin (no PIN).
3. **Auth providers** → Authentication → Providers:
   - Email: **disabled** (sign-in is Google only; the admin check relies on Google-verified emails).
   - Google: enable and add a Google OAuth client ID/secret (Google Cloud Console → Credentials;
     redirect URI is shown on the Supabase Google provider page).
4. **URLs** → Authentication → URL Configuration: add your Vercel URL and `http://localhost:5173` to
   *Site URL* / *Redirect URLs*.
5. **Env** → `cp .env.example .env.local` and fill in the project URL and anon key.

## Run locally

```bash
npm install
npm run dev
```

## Deploy (Vercel)

Import the GitHub repo, framework preset *Vite*, and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
as environment variables. `vercel.json` already handles the build and SPA rewrites.

## How it works

- Menu is public (`menu_items`), live via Supabase Realtime. Only the admin account can edit it (RLS).
- Checkout requires login, then name + 10-digit phone (stored in `profiles`).
- Orders are created by the `place_order()` SQL function: it prices items from the DB, enforces
  BOGO1ST (once per phone *and* per account), saves the order, and the app shows an in-app confirmation.
- The owner sees new orders live in the admin portal (Orders tab, with a badge and beep) and can open or
  close the shop with the Open/Closed switch; while closed, customers can browse but not order.

## Security notes

- Migrations run in order: `0001_init.sql`, `0002_orders_realtime_and_shop_status.sql`, `0003_security_hardening.sql`.
- Clients can only edit `name` and `phone` on their own profile (column grants), and can only create orders
  through `place_order()`, which caps cart size, limits pending/hourly orders per account and fixes the pincode.
- Admin = confirmed email in `admin_emails` **and** a linked Google identity.
- **Known accepted risk:** phone numbers are not verified (no OTP), so the BOGO once-per-phone rule can be
  sidestepped with a second Google account and a made-up number. The once-per-account rule still holds.
- In the Supabase dashboard keep *Authentication → Providers → Email* disabled and review the auth rate limits.
- Firebase decommission (manual, in the Firebase console): the old API key and database URL are in git history,
  so set Realtime Database rules to deny all (or delete the database), then restrict/rotate the API key.

## Dependencies and `npm audit`

- Production dependencies (`react`, `react-dom`, `@supabase/supabase-js`) have **0** known vulnerabilities (`npm audit --omit=dev`).
- Remaining findings are in dev-only tooling that is never shipped or run in production: the `vercel` and
  `supabase` CLIs (transitive `tar`, `zod`, `js-yaml`, `ajv`) and ESLint (`minimatch`, `glob`). They need upstream
  releases; do **not** run `npm audit fix --force` (it downgrades the CLIs). Re-check with `npm audit` now and then.
- Install scripts are denied in `package.json` (`allowScripts`). `esbuild`'s postinstall only verifies its binary
  (the real binary comes from a platform package) and `koffi` is a CLI-only native helper; builds, tests and CI work without them.
