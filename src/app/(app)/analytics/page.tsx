import { createClient } from "@/lib/supabase/server";
import { naira } from "@/components/Naira";
import AnalyticsControls from "@/components/AnalyticsControls";
import BarChart, { type Bar } from "@/components/BarChart";
import TrendChart, { type MonthPoint } from "@/components/TrendChart";
import SpendingDonut, { type Slice } from "@/components/SpendingDonut";
import { TrendingUpIcon, RepeatIcon, WalletIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

type Granularity = "day" | "week" | "month";

function resolveRange(range: string): { start: Date; end: Date; gran: Granularity } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const startOfMonth = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 1));
  switch (range) {
    case "this_month":
      return { start: startOfMonth(y, m), end: startOfMonth(y, m + 1), gran: "day" };
    case "last_month":
      return { start: startOfMonth(y, m - 1), end: startOfMonth(y, m), gran: "day" };
    case "3m":
      return { start: startOfMonth(y, m - 2), end: startOfMonth(y, m + 1), gran: "week" };
    case "12m":
      return { start: startOfMonth(y, m - 11), end: startOfMonth(y, m + 1), gran: "month" };
    case "ytd":
      return { start: startOfMonth(y, 0), end: startOfMonth(y, m + 1), gran: "month" };
    case "6m":
    default:
      return { start: startOfMonth(y, m - 5), end: startOfMonth(y, m + 1), gran: "month" };
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

// Monday-based week start (UTC).
function weekStart(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x;
}

// Ordered buckets between [start, end) at the given granularity.
function buildBuckets(start: Date, end: Date, gran: Granularity) {
  const buckets: { key: string; label: string }[] = [];
  const keyOf = (d: Date) => {
    if (gran === "day") return iso(d);
    if (gran === "week") return iso(weekStart(d));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const labelOf = (d: Date) => {
    if (gran === "day") return String(d.getUTCDate());
    if (gran === "week")
      return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return d.toLocaleDateString("en-NG", { month: "short", timeZone: "UTC" });
  };
  const cur =
    gran === "week" ? weekStart(start) : new Date(start.getTime());
  const seen = new Set<string>();
  while (cur < end) {
    const key = keyOf(cur);
    if (!seen.has(key)) {
      seen.add(key);
      buckets.push({ key, label: labelOf(cur) });
    }
    if (gran === "day") cur.setUTCDate(cur.getUTCDate() + 1);
    else if (gran === "week") cur.setUTCDate(cur.getUTCDate() + 7);
    else cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return buckets;
}

function bucketKey(dateISO: string, gran: Granularity) {
  if (gran === "month") return dateISO.slice(0, 7);
  if (gran === "day") return dateISO;
  return iso(weekStart(new Date(dateISO)));
}

type Dated = { amount: number; occurred_on: string; category?: string | null };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range = sp.range ?? "6m";
  const { start, end, gran } = resolveRange(range);
  const supabase = await createClient();

  const monthStart = new Date();
  const mStartISO = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);

  const [{ data: exp }, { data: inc }, { data: budgetRows }, { data: rules }] =
    await Promise.all([
      supabase
        .from("expenses")
        .select("amount,category,occurred_on")
        .gte("occurred_on", iso(start))
        .lt("occurred_on", iso(end)),
      supabase
        .from("income")
        .select("amount,occurred_on")
        .gte("occurred_on", iso(start))
        .lt("occurred_on", iso(end)),
      supabase.from("budgets").select("id,category,monthly_limit"),
      supabase.from("recurring_rules").select("kind,amount,category,frequency"),
    ]);

  const expenses = (exp as Dated[]) ?? [];
  const income = (inc as Dated[]) ?? [];

  const totalExp = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const totalInc = income.reduce((s, r) => s + Number(r.amount), 0);
  const net = totalInc - totalExp;
  const savingsRate = totalInc > 0 ? Math.round((net / totalInc) * 100) : 0;

  // Buckets for time-series.
  const buckets = buildBuckets(start, end, gran);
  const expByBucket = new Map(buckets.map((b) => [b.key, 0]));
  const incByBucket = new Map(buckets.map((b) => [b.key, 0]));
  for (const e of expenses) {
    const k = bucketKey(e.occurred_on, gran);
    if (expByBucket.has(k)) expByBucket.set(k, expByBucket.get(k)! + Number(e.amount));
  }
  for (const i of income) {
    const k = bucketKey(i.occurred_on, gran);
    if (incByBucket.has(k)) incByBucket.set(k, incByBucket.get(k)! + Number(i.amount));
  }

  const spendBars: Bar[] = buckets.map((b) => ({
    label: b.label,
    value: expByBucket.get(b.key) ?? 0,
  }));
  const trend: MonthPoint[] = buckets.map((b) => ({
    label: b.label,
    income: incByBucket.get(b.key) ?? 0,
    expense: expByBucket.get(b.key) ?? 0,
  }));
  const savingsBars: Bar[] = buckets.map((b) => {
    const i = incByBucket.get(b.key) ?? 0;
    const e = expByBucket.get(b.key) ?? 0;
    return { label: b.label, value: i > 0 ? Math.round(((i - e) / i) * 100) : 0 };
  });

  // Category donut for the range.
  const sliceMap = new Map<string, Slice>();
  for (const e of expenses) {
    const name = e.category ?? "Other";
    const key = name.toLowerCase();
    const prev = sliceMap.get(key);
    if (prev) prev.amount += Number(e.amount);
    else sliceMap.set(key, { category: name, amount: Number(e.amount) });
  }
  const slices = [...sliceMap.values()];

  // Budget adherence — this month (budgets are monthly).
  const spentThisMonth = new Map<string, number>();
  for (const e of expenses) {
    if (e.occurred_on >= mStartISO) {
      const k = (e.category ?? "Other").toLowerCase();
      spentThisMonth.set(k, (spentThisMonth.get(k) ?? 0) + Number(e.amount));
    }
  }
  const adherence = ((budgetRows as { id: string; category: string; monthly_limit: number }[]) ?? []).map(
    (b) => {
      const spent = spentThisMonth.get(b.category.toLowerCase()) ?? 0;
      const limit = Number(b.monthly_limit);
      return { category: b.category, spent, limit, pct: limit > 0 ? Math.round((spent / limit) * 100) : 0 };
    },
  );

  // Recurring expenses — normalise to a monthly figure.
  const perMonth = (freq: string, amt: number) =>
    freq === "daily" ? amt * 30 : freq === "weekly" ? amt * 4.33 : amt;
  const recurringExpenses = (
    (rules as { kind: string; amount: number; category: string; frequency: string }[]) ?? []
  ).filter((r) => r.kind === "expense");
  const recurringMonthly = recurringExpenses.reduce(
    (s, r) => s + perMonth(r.frequency, Number(r.amount)),
    0,
  );

  const spendTitle =
    gran === "day" ? "Daily spending" : gran === "week" ? "Weekly spending" : "Monthly spending";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <TrendingUpIcon className="text-xl text-brand-accent" />
        <h1 className="text-xl font-semibold">Analytics</h1>
      </div>

      <AnalyticsControls />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Income" value={naira(totalInc)} tint="text-green-400" />
        <Kpi label="Expenses" value={naira(totalExp)} tint="text-brand-accent" />
        <Kpi label="Net" value={naira(net)} tint={net < 0 ? "text-red-400" : "text-green-400"} />
        <Kpi
          label="Savings rate"
          value={`${savingsRate}%`}
          tint={savingsRate < 0 ? "text-red-400" : "text-green-400"}
        />
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-muted">
          <WalletIcon className="text-base text-brand-accent" />
          {spendTitle}
        </div>
        <BarChart bars={spendBars} format={(n) => naira(n)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TrendChart months={trend} title="Income vs expenses" />
        <SpendingDonut slices={slices} title="Spending by category" />
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-muted">
          <TrendingUpIcon className="text-base text-brand-accent" />
          Savings rate over time (%)
        </div>
        <BarChart bars={savingsBars} color="#199e70" format={(n) => `${Math.round(n)}%`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-muted">
            <WalletIcon className="text-base text-brand-accent" />
            Budget adherence · this month
          </div>
          {adherence.length === 0 ? (
            <p className="text-sm text-brand-muted">No budgets set yet.</p>
          ) : (
            <div className="space-y-3">
              {adherence.map((a) => (
                <div key={a.category}>
                  <div className="flex justify-between text-sm">
                    <span>{a.category}</span>
                    <span className="text-brand-muted">
                      {naira(a.spent)} / {naira(a.limit)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-brand-bg">
                    <div
                      className={`h-full rounded-full ${a.pct >= 100 ? "bg-red-500" : a.pct >= 80 ? "bg-orange-500" : "bg-brand-accent"}`}
                      style={{ width: `${Math.min(a.pct, 100)}%` }}
                    />
                  </div>
                  <div className="mt-0.5 text-xs text-brand-muted">{a.pct}% used</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-muted">
            <RepeatIcon className="text-base text-brand-accent" />
            Recurring expenses
          </div>
          {recurringExpenses.length === 0 ? (
            <p className="text-sm text-brand-muted">No recurring expenses set up.</p>
          ) : (
            <>
              <div className="mb-3 text-sm">
                About <b className="text-brand-accent">{naira(recurringMonthly)}</b> per month
              </div>
              <div className="divide-y divide-white/5">
                {recurringExpenses.map((r, i) => (
                  <div key={i} className="flex justify-between py-2 text-sm">
                    <span>
                      {r.category} <span className="text-brand-muted">· {r.frequency}</span>
                    </span>
                    <span className="text-brand-muted">{naira(Number(r.amount))}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-brand-muted">{label}</div>
      <div className={`mt-1 text-lg font-bold ${tint}`}>{value}</div>
    </div>
  );
}
