// Parse a bank "transaction alert" email into a structured expense/income.
// Kept provider-agnostic: it reads the subject + body text and looks for an
// amount and a debit/credit signal, plus a best-effort merchant and category.
// Nigerian bank alerts vary a lot, so this is deliberately forgiving and easy
// to extend — add patterns to the arrays below as you see your bank's wording.

export type ParsedEmail = {
  kind: "expense" | "income";
  amount: number;
  description: string;
  category: string;
  occurred_on: string; // YYYY-MM-DD (Lagos)
};

const CREDIT =
  /\b(credited|credit|cr|received|inflow|deposit(ed)?|salary|reversal|refund)\b/i;
const DEBIT =
  /\b(debited|debit|dr|withdrawal|withdrawn|purchase|spent|pos|paid|payment of|transfer to|charge[d]?)\b/i;

// Amounts like "NGN 5,000.00", "₦5,000", "N5,000.00", or "Amount: 5,000.00".
const AMOUNT_PATTERNS = [
  /(?:ngn|₦|n)\s?([\d,]+(?:\.\d{1,2})?)/i,
  /amount[:\s]+(?:ngn|₦|n)?\s?([\d,]+(?:\.\d{1,2})?)/i,
];

const CATEGORY_RULES: [RegExp, string][] = [
  [/uber|bolt|taxi|transport|fuel|petrol|fare|filling station/i, "Transport"],
  [/restaurant|eatery|kfc|domino|chicken|jumia food|glovo|chowdeck|food/i, "Food"],
  [/airtime|data|mtn|glo\b|airtel|9mobile|recharge|top ?up/i, "Airtime & Data"],
  [/dstv|gotv|netflix|spotify|subscription|prime video|showmax/i, "Subscriptions"],
  [/electric|nepa|phcn|ikedc|eko\b|aedc|power|utility|water bill/i, "Utilities"],
  [/rent|landlord/i, "Rent"],
  [/school|tuition|fees|waec|jamb/i, "Education"],
  [/hospital|pharmacy|clinic|drug|health/i, "Health"],
  [/supermarket|shoprite|market|grocery|store|mall/i, "Shopping"],
  [/transfer|trf|to\s+\w+/i, "Transfer"],
];

function categorise(text: string): string {
  for (const [re, cat] of CATEGORY_RULES) if (re.test(text)) return cat;
  return "Bank";
}

// Pull a merchant/counterparty out of common phrasings.
function merchant(text: string): string | null {
  const m =
    text.match(/\bat\s+([A-Z0-9][A-Za-z0-9 &'./-]{2,40})/) ||
    text.match(/\bto\s+([A-Z0-9][A-Za-z0-9 &'./-]{2,40})/) ||
    text.match(/\bfrom\s+([A-Z0-9][A-Za-z0-9 &'./-]{2,40})/) ||
    text.match(/\bdesc(?:ription)?[:\s]+([A-Za-z0-9 &'./-]{2,40})/i);
  if (!m) return null;
  return m[1].trim().replace(/\s+/g, " ").replace(/[.\s]+$/, "");
}

function lagosDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(d);
}

export function parseBankEmail(input: {
  subject?: string | null;
  body?: string | null;
  from?: string | null;
  receivedAt?: string | null;
}): ParsedEmail | null {
  const text = `${input.subject ?? ""}\n${input.body ?? ""}`;
  if (!text.trim()) return null;

  let amount = 0;
  for (const re of AMOUNT_PATTERNS) {
    const m = text.match(re);
    if (m) {
      amount = Number(m[1].replace(/,/g, ""));
      if (amount > 0) break;
    }
  }
  if (!amount || amount <= 0) return null;

  const isCredit = CREDIT.test(text);
  const isDebit = DEBIT.test(text);
  // Credit-only → income; anything else defaults to an expense (most alerts).
  const kind: "expense" | "income" = isCredit && !isDebit ? "income" : "expense";

  const who = merchant(text);
  const occurred_on = lagosDate(input.receivedAt ?? undefined);

  if (kind === "income") {
    return {
      kind,
      amount,
      description: who ? `From ${who}` : (input.subject ?? "Bank credit"),
      category: "Bank credit",
      occurred_on,
    };
  }
  return {
    kind,
    amount,
    description: who ?? (input.subject ?? "Bank debit"),
    category: categorise(text),
    occurred_on,
  };
}
