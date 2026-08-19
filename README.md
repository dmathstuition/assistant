# D-Maths Assistant

A personal productivity + finance assistant, installable as a phone app (PWA).
Next.js 15 (App Router) + Supabase (Postgres, Auth, Row-Level Security) + a
DeepSeek-powered command box, with Google Apps Script as a free bridge for
Gmail / Google Sheets / Drive.

**What it does:** expenses, income, tasks (with time), reminders, budgets,
savings goals, recurring transactions, CSV import/export, charts, an analytics
page, a planner, an assistant that understands plain English, web-push
notifications, and task alarms (in-app and scheduled).

You don't need Node.js on your laptop — GitHub holds the code, Vercel builds and
hosts it, Supabase is the database.

---

## 1. Supabase (database)

1. supabase.com → **New project**. Pick a region near you; wait ~2 min.
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
   Re-running is safe — every block is idempotent. This creates all tables:
   profiles, tasks, expenses, income, reminders, budgets, savings_goals,
   budget_alerts, push_subscriptions, recurring_rules, task_alerts.
3. **Authentication → Providers → Email:** turn **OFF** "Confirm email" for a
   personal app (or leave it on — the app handles both).
4. Once you've created your one account, come back and turn **OFF new sign-ups**
   (Authentication settings) so the app stays yours only.
5. **Project Settings → API:** copy the **Project URL**, the **anon public** key,
   and the **service_role** key (secret).

## 2. Vercel (hosting)

1. vercel.com → **Add New → Project** → import `dmathstuition/assistant`.
   ⚠️ Make sure it's *this* repo, not the tutoring-portal repo.
2. Framework auto-detects **Next.js** — leave build settings as-is.
3. Add the **environment variables** from the table below.
4. **Deploy.** After it's live, in Supabase → **Authentication → URL
   Configuration** set **Site URL** to your Vercel URL and add
   `https://YOUR-APP.vercel.app/auth/callback` to **Redirect URLs**.

## 3. Environment variables

| Name | From | Secret? | Needed for |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → API | no | everything |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API | no | everything |
| `DEEPSEEK_API_KEY` | platform.deepseek.com | **yes** | the assistant command box |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API | **yes** | all cron jobs |
| `CRON_SECRET` | you invent a long random string | **yes** | all cron jobs |
| `VAPID_PUBLIC_KEY` | see step 4 | no | web push |
| `VAPID_PRIVATE_KEY` | see step 4 | **yes** | web push |
| `VAPID_SUBJECT` | `mailto:you@example.com` | no | web push |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | same value as `VAPID_PUBLIC_KEY` | no | web push (browser) |
| `APPSCRIPT_WEBHOOK_URL` | `google-appscript/README.md` | no | Gmail / Sheets / Drive |
| `APPSCRIPT_SHARED_SECRET` | you invent a long random string | **yes** | Apps Script bridge |
| `ALARM_TZ_OFFSET` | optional, minutes east of UTC (default `60` = WAT) | no | scheduled task alarms |

## 4. Push notifications (VAPID keys)

Web push needs one keypair. Generate it once with:

```
npx web-push generate-vapid-keys
```

Put the **public** key in **both** `VAPID_PUBLIC_KEY` and
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, the **private** key in `VAPID_PRIVATE_KEY`, and
set `VAPID_SUBJECT` to `mailto:` your email. Redeploy, then open the app and tap
**Enable notifications** on the dashboard.

## 5. Google Apps Script (free Gmail / Sheets / Drive)

See `google-appscript/README.md`. It powers reminder & alert emails, the
transaction mirror to a Google Sheet, the monthly summary doc, and (via a
5-minute time trigger) **task alarms even when the app is closed**.

## 6. Scheduled jobs

`vercel.json` defines these crons (Vercel Hobby runs them ~daily; the alarm
endpoint is driven every 5 min by the Apps Script trigger instead):

| Path | When | Does |
|---|---|---|
| `/api/keep-alive` | daily | keeps Supabase awake |
| `/api/reminders` | daily | sends the day's reminders (email + push) |
| `/api/alerts` | daily | 80% / 100% budget alerts |
| `/api/recurring` | daily | auto-logs recurring transactions |
| `/api/summary` | monthly | Drive doc + email summary |
| `/api/alarms/push` | every 5 min (Apps Script) | task time alarms when app is closed |

---

## Installing the app on your phone

The app is a PWA — it installs to your home screen like a native app.

1. **Open the site in Chrome** (Android) or **Safari** (iPhone) — *not* inside
   Telegram/Facebook/Instagram's built-in browser, which cannot install apps.
   If you opened a link from a chat, tap the ⋮ menu → **Open in Chrome** first.
2. Android: use the **Install app** card on the dashboard, or Chrome ⋮ →
   **Install app / Add to Home screen**.
3. iPhone: Safari **Share** → **Add to Home Screen**.
4. If you added an older version before, delete that icon first so the new
   service worker takes over.

## Making it single-user (only you)

RLS already isolates every row to its owner. To stop anyone else creating an
account, turn **off new sign-ups** in Supabase (step 1.4) after you've made
yours. That's the whole lock — no second account can exist.

## Folder map

```
src/app/(app)/            protected pages: dashboard, planner, history, analytics, guide
src/app/api/              assistant, exports, cron endpoints (reminders, alerts,
                          recurring, summary, alarms/push, push/subscribe, tasks/today)
src/app/actions.ts        server actions (add/edit/delete records, exports)
src/components/           UI: command box, charts, cards, alarms, install, icons…
src/lib/                  supabase clients, push (VAPID), cron helpers, apps-script bridge
supabase/schema.sql       run once in the SQL editor (idempotent)
google-appscript/         the script you deploy for Gmail/Sheets/Drive/alarms
```
