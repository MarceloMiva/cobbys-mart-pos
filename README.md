# Cobbys Mart POS

Standalone POS app for Cobbys Mart — real Supabase database, staff login
with cashier/manager roles, your logo and orange branding baked in,
deployable to your own Vercel URL.

## 1. Create the database (Supabase)

1. Go to supabase.com/dashboard → **New project** (free tier is fine).
2. Once it's ready, open **SQL Editor** → paste the entire contents of
   `supabase/migration.sql` → **Run**.
3. Go to **Settings → API**. Copy:
   - **Project URL**
   - **anon / public** key (not the `service_role` key — never put that one
     in this app, it bypasses all the security rules below)

## 2. Create the first staff login (this becomes the manager)

1. In the Supabase dashboard: **Authentication → Users → Add user**. Enter
   an email and password for whoever will manage the shop. (Auto-confirm
   the user, or turn off "Confirm email" under Authentication → Settings so
   you don't need an email server for this.)
2. That account is created with role `cashier` by default. Promote it to
   manager: go back to **SQL Editor** and run, with the real email:
   ```sql
   update profiles set role = 'manager' where email = 'owner@example.com';
   ```
3. For every other staff member (cashiers), just add their login the same
   way in **Authentication → Users** — no extra SQL needed, they default to
   `cashier`. The manager can also promote/demote anyone from the app's
   **Team** tab afterward.

## 3. Configure the app

Copy `.env.example` to `.env` and fill in the two values from step 1:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

(Optional) test it locally first:
```
npm install
npm run dev
```

## 4. Deploy to Vercel

1. Push this folder to a GitHub repo (same way you've done your other
   `.vercel.app` projects).
2. On vercel.com → **Add New… → Project** → import that repo. Vercel
   auto-detects Vite, no config needed.
3. Before deploying, add the two environment variables from step 3 under
   **Environment Variables** (same names: `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`).
4. Deploy. You'll get a `your-project.vercel.app` URL — that's the one to
   give the shop.

## 5. Using it at the shop

- Cashier device: open the Vercel URL, sign in with their email/password.
- Customer device: open the **same URL**, tap "This is the customer
  display" on the sign-in screen (no login needed) — or tap the monitor
  icon from inside the app. It updates live via Supabase Realtime.
- Manager: signs in like a cashier, but sees an extra **Team** tab —
  today's and all-time sales per staff member, plus promote/demote buttons.
- The calculator icon works standalone, and can drop its result straight
  into "amount tendered" during cash checkout.
- Sign out from **Settings** (gear icon) at the bottom of that panel.

## Branding

- `public/logo.png` and `public/favicon.png` are generated from your
  uploaded logo — swap either file (keep the same filenames) to update it.
- The orange palette lives in one place: the `:root { --brand: ...; }`
  block near the top of `src/App.jsx`. Change those few hex values to
  re-theme the whole app.
- The tagline "Shop Smart. Shop Cobby's" is a fixed constant (`TAGLINE`)
  near the top of `src/App.jsx`, shown on the sign-in and customer screens.

## Notes / tradeoffs

- **Adding/removing staff logins** happens in the Supabase dashboard
  (Authentication → Users), not in the app — creating or deleting a login
  is an administrative action that needs your Supabase account, not
  something safe to expose to a browser-side app. Role changes
  (cashier ↔ manager) for *existing* logins can be done from the Team tab.
- **RLS is locked down**: only signed-in staff can read or write products,
  sales, and settings. The one deliberate exception is the customer screen,
  which can read (never write) the live cart and shop name without logging
  in, since it has no login of its own.
- **Free tier limits.** Supabase's free tier pauses a project after a week
  of no API activity — a daily sale or two keeps it awake. Vercel's free
  tier is generous enough for a single shop's traffic.
- Every sale now records which cashier rang it up, visible in History and
  summarized per-person in the Team tab.
