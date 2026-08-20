# Bank linking (Mono)

Automatically import your spending by connecting your bank through
[Mono](https://mono.co) — a licensed Nigerian open-banking provider. Your bank
login is entered into **Mono's** secure widget; this app never sees your bank
password. Imported debit transactions become expenses tagged `source = bank`,
auto-categorised from the narration, and de-duplicated by the Mono transaction
id so re-syncing never doubles anything.

## Setup

1. Create an account at **[mono.co](https://mono.co)** → create an app. You get a
   **public key** (`pk_...`) and a **secret key** (`sk_...`). Mono has a free/test
   tier; live data has per-account pricing.
2. In **Vercel → Environment Variables** add:
   - `MONO_SECRET_KEY` = your Mono secret key (server only)
   - `NEXT_PUBLIC_MONO_PUBLIC_KEY` = your Mono public key (browser)
   - `MONO_WEBHOOK_SECRET` = a value you also set in the Mono dashboard
3. In the **Mono dashboard → Webhooks**, set the webhook URL to
   `https://YOUR-APP.vercel.app/api/mono/webhook` and the secret to the same
   `MONO_WEBHOOK_SECRET`.
4. Run the **bank-linking migration** block in `supabase/schema.sql`
   (creates `linked_accounts`, adds `expenses.external_id`, allows `source='bank'`).
5. Redeploy. Open **Linked accounts** (dashboard → Bank) → **Connect a bank**.

## How it works

- **Connect** — the Mono widget returns a one-time `code`; `/api/mono/exchange`
  swaps it (with the secret key) for a permanent account id, stores the account,
  and imports its transactions once.
- **Sync now** — `/api/mono/sync` pulls the latest transactions for your linked
  accounts on demand.
- **Webhook** — when Mono has new data it POSTs to `/api/mono/webhook`; the app
  verifies the secret, finds the account's owner, and imports new transactions
  automatically.

## Notes / adjusting

This is a working scaffold against Mono's v2 API. If Mono changes field names,
the mappings live in `src/lib/mono.ts` (`exchangeCode`, `getAccount`,
`getTransactions`, `importTransactions`, and the `CATEGORY_RULES` for
auto-categorising). Amounts are converted from kobo to naira there.
