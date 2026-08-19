# D-Maths Assistant — Phase 1

A personal productivity + finance assistant. Next.js 15 (App Router) + Supabase
(Postgres, Auth, Row Level Security) + a Claude-powered command box.

**Phase 1 does:** email/password sign-in, a dashboard with this-month income /
expenses / net, manual add for expenses, income and tasks, task completion, and
an AI command box that turns plain English ("I spent 8,500 on transport") into a
saved record after you confirm it.

You do **not** need Node.js on your laptop. Everything is set up in the cloud:
GitHub holds the code, Vercel builds and hosts it, Supabase is the database.

---

## Step 1 — Put the code on GitHub

1. Create a new repository at github.com (empty, no README).
2. Click **Add file → Upload files**.
3. Drag in *the contents of this folder* (not the folder itself) — including the
   `src` folder, `supabase` folder, `package.json`, etc. Commit.

## Step 2 — Create the Supabase project

1. Go to supabase.com → New project. Pick a region close to you and a strong DB
   password. Wait ~2 minutes for it to provision.
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`,
   and click **Run**. You should see "Success".
3. **Auth → Providers → Email:** for a personal app, turn **OFF** "Confirm
   email" so you can sign in immediately after signing up. (Leave it on if you
   prefer the email link — the app handles both.)
4. **Project Settings → API:** copy the **Project URL** and the **anon public**
   key. You'll paste them into Vercel next.

## Step 3 — Get a Claude API key

1. Go to console.anthropic.com → **API Keys → Create key**. Copy it.
2. Recommended: **Settings → Limits** and set a low monthly usage limit (e.g.
   $5) so there's a hard ceiling. This app's parsing calls are tiny.

## Step 4 — Deploy on Vercel

1. Go to vercel.com → **Add New → Project** → import your GitHub repo.
2. Framework preset auto-detects **Next.js**. Don't change build settings.
3. Open **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` → your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → your Supabase anon public key
   - `ANTHROPIC_API_KEY` → your Claude key
   - `SUPABASE_SERVICE_ROLE_KEY` → *(optional, for keep-alive)* the service_role
     key from Supabase → Settings → API. Keep it secret.
4. Click **Deploy**. First build takes ~1–2 minutes.

## Step 5 — Point Supabase auth at your live URL

After the deploy, copy your Vercel URL (e.g. `https://your-app.vercel.app`).
In Supabase → **Authentication → URL Configuration**, set:
- **Site URL** → your Vercel URL
- **Redirect URLs** → add `https://your-app.vercel.app/auth/callback`

Now open your Vercel URL, create an account, and you're in.

---

## Keeping the free tier awake (optional but recommended)

Supabase pauses a free project after ~7 idle days. `vercel.json` already defines
a daily cron that pings `/api/keep-alive`. It only works if you set
`SUPABASE_SERVICE_ROLE_KEY` in Vercel. (Vercel's free Hobby plan allows one
daily cron — this is it.) Also **export your data periodically** from the
Supabase dashboard: the free tier keeps no backups.

## Environment variables (summary)

| Name | Where from | Public? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | yes (safe) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | yes (safe) |
| `ANTHROPIC_API_KEY` | console.anthropic.com | **NO — server only** |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | **NO — server only** |

## What's deliberately NOT in Phase 1

Bank/Open-Banking integration, offline sync, real push notifications, charts,
budgets, savings goals, monthly AI reports, and answering data questions
("how much did I spend on food?"). These are the next phases — the schema and
structure are already laid out to grow into them.

## Folder map

```
src/
  middleware.ts            session refresh + route protection
  app/
    layout.tsx             root layout
    page.tsx               redirects to /dashboard or /login
    login/page.tsx         sign in / sign up
    auth/callback/route.ts email-confirmation code exchange
    (app)/
      layout.tsx           protected shell (redirects if signed out)
      dashboard/page.tsx   the dashboard
    api/
      assistant/route.ts   calls Claude, returns a structured action
      keep-alive/route.ts  daily cron ping
    actions.ts             server actions (add expense/income/task, save AI action)
  components/              CommandBox, QuickAdd, TaskItem, SignOutButton
  lib/supabase/            browser + server + middleware clients
supabase/schema.sql        run this once in the SQL editor
```
