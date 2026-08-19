// Bridge to a Google Apps Script "web app" that the user deploys under their own
// Google account (see google-appscript/Code.gs). One HTTPS endpoint, protected
// by a shared secret, lets us mirror transactions into a Sheet, push exports,
// save a monthly summary to Drive, and send Gmail — with no Google Cloud
// project, OAuth consent screen, or stored tokens, and no cost.
//
// Every call is best-effort: if the bridge isn't configured or is unreachable it
// resolves to { ok: false } and never throws, so a failed sync can't break a
// user's save or a cron run.

export type AppScriptType =
  | "transaction" // append an expense/income row to the ledger Sheet
  | "export" // build a fresh Sheet from many rows, return its URL
  | "summary" // save a monthly summary doc to Drive + email it
  | "mail"; // send a plain email via Gmail

type AppScriptResult = {
  ok: boolean;
  url?: string;
  error?: string;
};

export function appScriptConfigured() {
  return Boolean(
    process.env.APPSCRIPT_WEBHOOK_URL && process.env.APPSCRIPT_SHARED_SECRET,
  );
}

export async function callAppScript(
  type: AppScriptType,
  data: Record<string, unknown>,
): Promise<AppScriptResult> {
  const url = process.env.APPSCRIPT_WEBHOOK_URL;
  const secret = process.env.APPSCRIPT_SHARED_SECRET;
  if (!url || !secret) return { ok: false, error: "not configured" };

  try {
    // Guard against a hung Apps Script call blocking a save/cron for too long.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, type, data }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = (await res.json().catch(() => ({}))) as Partial<AppScriptResult>;
    return { ok: json.ok ?? true, url: json.url, error: json.error };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Fire-and-forget mirror of one transaction to the Google Sheet. Never throws.
export async function mirrorTransaction(row: {
  kind: "expense" | "income";
  amount: number;
  category: string;
  description: string | null;
  occurred_on: string;
  email: string | null;
}) {
  if (!appScriptConfigured()) return;
  try {
    await callAppScript("transaction", row);
  } catch {
    /* best-effort; a sync failure must not affect the user's save */
  }
}

export async function sendMail(to: string, subject: string, html: string) {
  return callAppScript("mail", { to, subject, html });
}
