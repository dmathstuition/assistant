# Email import (bank alerts → expenses)

Automatically log spending from your bank's **transaction alert emails**. Your
Google Apps Script scans Gmail for the alerts and forwards each to the app,
which reads the amount and the debit/credit signal and saves it — as an expense
(debit) or income (credit), de-duplicated by the Gmail message id so re-runs
never double count.

Nothing new is needed in Vercel: the importer reuses your `CRON_SECRET`. Parsing
lives in `src/lib/emailParse.ts` (easy to tune to your bank without touching
Apps Script).

## Setup

1. Run the **email-import migration** in `supabase/schema.sql` (adds
   `income.external_id` + a unique index, and allows `source='bank'` on income).
   It's idempotent — safe to re-run the whole file.
2. Open your Apps Script project (`google-appscript/Code.gs`) and set, near the
   bottom:
   - `INGEST_URL` = `https://YOUR-APP.vercel.app/api/ingest/email?key=YOUR_CRON_SECRET`
   - `BANK_QUERY` = a Gmail search that matches **your** bank's alerts, e.g.
     - `from:alerts@gtbank.com newer_than:2d`
     - `subject:(transaction alert OR debit alert OR credit alert) newer_than:2d`
3. In Apps Script → **Triggers** (clock icon) → **Add Trigger**:
   - Function: `scanBankEmails`
   - Event source: **Time-driven** → **Hour timer** → every 1 hour.
4. Run `scanBankEmails` once from the editor to grant the Gmail permission.

Handled threads get a **"D-Maths Imported"** Gmail label so the same email is
never sent twice.

## Tuning

- **Only real alerts:** make `BANK_QUERY` as specific as you can (ideally
  `from:` your bank's alert address) so newsletters/OTPs aren't imported.
- **Wrong category or debit/credit?** Add patterns to `CATEGORY_RULES`,
  `CREDIT`, or `DEBIT` in `src/lib/emailParse.ts`. If an email has no
  recognisable amount it's skipped, not guessed.
- **Amounts** are read as Naira. The importer converts `1,234.56`-style
  strings; it does not do FX.

## Safety

- The endpoint is gated by `CRON_SECRET` (same as the other scheduled routes)
  and uses the service-role key only behind that gate.
- Imports are de-duplicated per Gmail message id, so a duplicate scan is a
  no-op. Everything the importer creates appears in **History**, where you can
  edit or delete it like any other entry.
