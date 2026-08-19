# Google Apps Script bridge

This folder holds `Code.gs`, a small Google Apps Script "web app" that lets
D-Maths talk to your own Google account with **no Google Cloud project, no OAuth
consent screen, and no cost**. It runs as you, on your free Google quota.

## What it does

The Next.js app POSTs JSON to one URL (protected by a shared secret). The script
routes on a `type` field:

| type          | effect                                                              |
| ------------- | ------------------------------------------------------------------- |
| `transaction` | append the expense/income to a **"D-Maths Ledger"** Google Sheet     |
| `export`      | create a fresh Sheet from your full history, return its URL          |
| `summary`     | save a monthly summary **Google Doc** to Drive and email it          |
| `mail`        | send a reminder / alert email via **Gmail**                          |

## Setup (5 minutes)

1. Go to [script.google.com](https://script.google.com) → **New project**.
2. Delete the sample code and paste the contents of `Code.gs`.
3. Change `SHARED_SECRET` at the top to a long random string.
4. **Deploy → New deployment → Web app**:
   - **Execute as:** Me
   - **Who has access:** Anyone
   - Copy the **Web app URL** (ends in `/exec`).
5. In Vercel → Project → Settings → Environment Variables, add:
   - `APPSCRIPT_WEBHOOK_URL` = the `/exec` URL
   - `APPSCRIPT_SHARED_SECRET` = the same secret you set in step 3
6. The first time it runs, Google will ask you to authorize Gmail/Drive/Sheets
   access — approve it (it's your own script).

## Security

The web app URL is public, so the script authenticates **every** request against
`SHARED_SECRET` and refuses anything without a match. Keep the secret out of the
client — it lives only in the Apps Script and in Vercel server env vars. Nothing
in the browser ever sees it.

## Notes

- Reminder and budget-alert emails, and the monthly summary email, all send from
  **your** Gmail — free, within Google's daily send limits.
- If you don't set the two env vars, every Google feature simply no-ops; the app
  keeps working (saves still hit Supabase, CSV export still works).
