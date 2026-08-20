import type { SupabaseClient } from "@supabase/supabase-js";

// Mono (mono.co) open-banking helpers. Server-side only (uses the secret key).
// NOTE: this is a scaffold — field names follow Mono's v2 API at time of
// writing; if Mono changes their shapes, adjust the mappings below.
const BASE = "https://api.withmono.com/v2";

export function monoConfigured() {
  return Boolean(process.env.MONO_SECRET_KEY);
}

function headers() {
  return {
    accept: "application/json",
    "content-type": "application/json",
    "mono-sec-key": process.env.MONO_SECRET_KEY ?? "",
  };
}

// Exchange the Connect widget's `code` for a permanent account id.
export async function exchangeCode(code: string): Promise<string | null> {
  const r = await fetch(`${BASE}/accounts/auth`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ code }),
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { id?: string; data?: { id?: string } };
  return j.id ?? j.data?.id ?? null;
}

export type MonoAccount = {
  institution: string | null;
  name: string | null;
  mask: string | null;
  currency: string;
};

export async function getAccount(accountId: string): Promise<MonoAccount | null> {
  const r = await fetch(`${BASE}/accounts/${accountId}`, { headers: headers() });
  if (!r.ok) return null;
  const j = (await r.json()) as {
    account?: { institution?: { name?: string }; name?: string; accountNumber?: string; currency?: string };
    data?: { account?: { institution?: { name?: string }; name?: string; accountNumber?: string; currency?: string } };
  };
  const a = j.account ?? j.data?.account;
  if (!a) return null;
  const num = a.accountNumber ?? "";
  return {
    institution: a.institution?.name ?? null,
    name: a.name ?? null,
    mask: num ? num.slice(-4) : null,
    currency: a.currency ?? "NGN",
  };
}

export type MonoTxn = {
  id: string;
  narration: string;
  amount: number; // Mono returns NGN in kobo
  type: "debit" | "credit";
  date: string;
  category?: string | null;
};

export async function getTransactions(accountId: string): Promise<MonoTxn[]> {
  const r = await fetch(`${BASE}/accounts/${accountId}/transactions?paginate=false`, {
    headers: headers(),
  });
  if (!r.ok) return [];
  const j = (await r.json()) as { data?: MonoTxn[]; transactions?: MonoTxn[] };
  return j.data ?? j.transactions ?? [];
}

// Rule-based category from the bank narration.
const CATEGORY_RULES: [RegExp, string][] = [
  [/uber|bolt|taxi|transport|fuel|petrol|filling|brt|keke/i, "Transportation"],
  [/restaurant|eatery|food|kfc|dominos|chicken|jollof|buka|cafe|kitchen/i, "Food"],
  [/rent|landlord|lease/i, "Rent"],
  [/electric|nepa|phcn|ikedc|eko|water|utility|dstv|gotv|startimes/i, "Utilities"],
  [/school|tuition|waec|jamb|book|exam|course|udemy/i, "Education"],
  [/data|airtime|mtn|glo|airtel|9mobile|internet|spectranet/i, "Subscriptions"],
  [/netflix|spotify|prime|subscription|apple\.com|google/i, "Subscriptions"],
  [/hospital|clinic|pharmacy|chemist|drug|health/i, "Healthcare"],
  [/shop|store|mall|market|shoprite|jumia|konga|amazon/i, "Shopping"],
  [/salary|payroll|wages/i, "Business"],
];

export function categorise(narration: string): string {
  for (const [re, cat] of CATEGORY_RULES) if (re.test(narration)) return cat;
  return "Other";
}

// Import a batch of Mono transactions as expenses for `userId`. Only debits
// become expenses; each is deduped by external_id ("mono:<txn id>"). Amounts are
// converted from kobo to naira. Returns how many new rows were inserted.
export async function importTransactions(
  db: SupabaseClient,
  userId: string,
  txns: MonoTxn[],
): Promise<number> {
  const rows = txns
    .filter((t) => t.type === "debit" && t.amount > 0)
    .map((t) => ({
      user_id: userId,
      amount: Math.round((t.amount / 100) * 100) / 100, // kobo → naira
      category: categorise(t.narration || ""),
      description: t.narration || null,
      occurred_on: (t.date || new Date().toISOString()).slice(0, 10),
      source: "bank",
      external_id: `mono:${t.id}`,
    }));
  if (rows.length === 0) return 0;

  // ignoreDuplicates → existing external_ids are skipped, so re-syncs are safe.
  const { data, error } = await db
    .from("expenses")
    .upsert(rows, { onConflict: "user_id,external_id", ignoreDuplicates: true })
    .select("id");
  if (error) return 0;
  return data?.length ?? 0;
}
