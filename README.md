# Night Eats

React + TypeScript (Vite) storefront, Supabase (Auth + Postgres + Realtime), hosted on Vercel.
The original single-file Firebase page is kept in `legacy/index.html` for reference.

## One-time setup

1. **Supabase project** → create one at supabase.com.
2. **Schema** → `supabase/migrations/0001_init.sql` seeds `admin_emails` with the owner's Gmail
   (`parikhdhairy13@gmail.com`; change it in the file before running if needed), then run it in
   *SQL Editor* or with `npx supabase db push`. That Gmail is the only admin (no PIN).
3. **Auth providers** → Authentication → Providers:
   - Email: enabled, keep **Confirm email ON** (admin check requires a verified email).
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

Import the GitHub repo, framework preset *Vite*, and add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_OWNER_PHONE` as environment variables. `vercel.json` already handles the build and SPA rewrites.

## How it works

- Menu is public (`menu_items`), live via Supabase Realtime. Only the admin account can edit it (RLS).
- Checkout requires login, then name + 10-digit phone (stored in `profiles`).
- Orders are created by the `place_order()` SQL function: it prices items from the DB, enforces
  BOGO1ST (once per phone *and* per account), saves the order, then the app opens the WhatsApp message.
