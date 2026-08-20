import { createClient } from "@/lib/supabase/server";
import { naira } from "@/components/Naira";
import ReportControls from "@/components/ReportControls";
import AiReport from "@/components/AiReport";
import { ListIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

type Exp = { amount: number; category: string | null; description: string | null };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const sum = (rows: { amount: number | string }[] | null) =>
  (rows ?? []).reduce((t, r) => t + (Number(r.amount) || 0), 0);

function weekStart(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x;
}

// Resolve a period to [start,end) plus the immediately-preceding period for
// comparison, with human labels.
function bounds(period: string) {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const day = new Date(Date.UTC(y, m, now.getUTCDate()));
  const mk = (s: Date, e: Date, label: string, ps: Date, pe: Date, plabel: string) => ({
    start: iso(s), end: iso(e), label, prevStart: iso(ps), prevEnd: iso(pe), prevLabel: plabel,
  });
  if (period === "day") {
    const next = new Date(day.getTime() + 86400000);
    const prev = new Date(day.getTime() - 86400000);
    return mk(day, next, "Today", prev, day, "yesterday");
  }
  if (period === "week") {
    const s = weekStart(now);
    const e = new Date(s.getTime() + 7 * 86400000);
    const ps = new Date(s.getTime() - 7 * 86400000);
    return mk(s, e, "This week", ps, s, "last week");
  }
  if (period === "last_month") {
    const s = new Date(Date.UTC(y, m - 1, 1));
    const e = new Date(Date.UTC(y, m, 1));
    const ps = new Date(Date.UTC(y, m - 2, 1));
    return mk(s, e, "Last month", ps, s, "the month before");
  }
  const s = new Date(Date.UTC(y, m, 1));
  const e = new Date(Date.UTC(y, m + 1, 1));
  const ps = new Date(Date.UTC(y, m - 1, 1));
  return mk(s, e, "This month", ps, s, "last month");
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period = "month" } = await searchParams;
  const b = bounds(period);
  const supabase = await createClient();

  const [
    { data: expRows },
    { data: incRows },
    { data: expPrevRows },
    { data: budgetRows },
    { data: ruleRows },
    { data: goalRows },
  ] = await Promise.all([
    supabase.from("expenses").select("amount,category,description").gte("occurred_on", b.start).lt("occurred_on", b.end),
    supabase.from("income").select("amount").gte("occurred_on", b.start).lt("occurred_on", b.end),
    supabase.from("expenses").select("amount,category").gte("occurred_on", b.prevStart).lt("occurred_on", b.prevEnd),
    supabase.from("budgets").select("category,monthly_limit"),
    supabase.from("recurring_rules").select("kind,amount,category,frequency"),
    supabase.from("savings_goals").select("name,current_amount,target_amount"),
  ]);

  const expenses = (expRows as Exp[]) ?? [];
  const income = sum(incRows);
  const spent = sum(expenses);
  const net = income - spent;

  // Top categories.
  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.category ?? "Other", (byCat.get(e.category ?? "Other") ?? 0) + Number(e.amount));
  const topCategories = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Prev-period category totals (for "unusual").
  const prevByCat = new Map<string, number>();
  for (const e of (expPrevRows as Exp[]) ?? [])
    prevByCat.set(e.category ?? "Other", (prevByCat.get(e.category ?? "Other") ?? 0) + Number(e.amount));

  // Budget performance.
  const budgets = ((budgetRows as { category: string; monthly_limit: number }[]) ?? []).map((bd) => {
    const s = byCat.get(bd.category) ?? 0;
    const limit = Number(bd.monthly_limit);
    return { category: bd.category, limit, spent: s, pct: limit > 0 ? Math.round((s / limit) * 100) : 0 };
  });

  // Largest transactions.
  const largest = expenses
    .slice()
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5);

  // Recurring expenses.
  const recurring = ((ruleRows as { kind: string; amount: number; category: string; frequency: string }[]) ?? [])
    .filter((r) => r.kind === "expense");

  // Unusual spending: single expenses far above the median, and categories that
  // jumped vs the previous period.
  const amounts = expenses.map((e) => Number(e.amount)).sort((a, b) => a - b);
  const median = amounts.length ? amounts[Math.floor(amounts.length / 2)] : 0;
  const unusualBig = expenses
    .filter((e) => median > 0 && Number(e.amount) > Math.max(median * 3, 5000))
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 4);
  const unusualCats = topCategories
    .filter(([cat, amt]) => {
      const prev = prevByCat.get(cat) ?? 0;
      return prev > 0 && amt > prev * 1.5 && amt - prev > 3000;
    })
    .map(([cat, amt]) => ({ cat, amt, prev: prevByCat.get(cat) ?? 0 }));

  // Savings goals.
  const goals = ((goalRows as { name: string; current_amount: number; target_amount: number }[]) ?? []).map((g) => ({
    name: g.name,
    current: Number(g.current_amount),
    target: Number(g.target_amount),
  }));
  const savedTotal = goals.reduce((s, g) => s + g.current, 0);

  // Compact JSON for the AI (real numbers only).
  const aiSummary = {
    period: b.label,
    income,
    expenses: spent,
    savings: net,
    net_cash_flow: net,
    savings_rate_pct: income > 0 ? Math.round((net / income) * 100) : 0,
    top_categories: topCategories.map(([c, a]) => ({ category: c, amount: a })),
    budgets: budgets.map((bd) => ({ category: bd.category, limit: bd.limit, spent: bd.spent, pct: bd.pct })),
    largest_transactions: largest.map((e) => ({ amount: Number(e.amount), category: e.category, description: e.description })),
    recurring_expenses: recurring.map((r) => ({ category: r.category, amount: Number(r.amount), frequency: r.frequency })),
    unusual_large: unusualBig.map((e) => ({ amount: Number(e.amount), category: e.category, description: e.description })),
    unusual_categories: unusualCats,
    goals: goals.map((g) => ({ name: g.name, saved: g.current, target: g.target })),
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ListIcon className="text-xl text-brand-accent" />
        <h1 className="text-xl font-semibold">Report · {b.label}</h1>
      </div>

      <ReportControls />

      {/* Headline figures */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Tile label="Income" value={naira(income)} tint="text-green-400" />
        <Tile label="Expenses" value={naira(spent)} tint="text-brand-accent" />
        <Tile label="Savings" value={naira(net)} tint={net < 0 ? "text-red-400" : "text-green-400"} />
        <Tile label="Net cash flow" value={naira(net)} tint={net < 0 ? "text-red-400" : "text-green-400"} />
      </div>

      <AiReport summary={aiSummary} />

      <Section title="Top spending categories">
        {topCategories.length === 0 ? (
          <Empty />
        ) : (
          topCategories.map(([cat, amt]) => (
            <Line key={cat} left={cat} right={`${naira(amt)} · ${Math.round((amt / (spent || 1)) * 100)}%`} />
          ))
        )}
      </Section>

      <Section title="Budget performance">
        {budgets.length === 0 ? (
          <p className="text-sm text-brand-muted">No budgets set. Budgets are monthly.</p>
        ) : (
          budgets.map((bd) => (
            <div key={bd.category} className="py-2">
              <div className="flex justify-between text-sm">
                <span>{bd.category}</span>
                <span className="text-brand-muted">{naira(bd.spent)} / {naira(bd.limit)}</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-brand-bg">
                <div
                  className={`h-full rounded-full ${bd.pct >= 100 ? "bg-red-500" : bd.pct >= 80 ? "bg-orange-500" : "bg-brand-accent"}`}
                  style={{ width: `${Math.min(bd.pct, 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </Section>

      <Section title="Largest transactions">
        {largest.length === 0 ? (
          <Empty />
        ) : (
          largest.map((e, i) => (
            <Line key={i} left={e.description || e.category || "Expense"} right={naira(Number(e.amount))} />
          ))
        )}
      </Section>

      <Section title="Recurring expenses">
        {recurring.length === 0 ? (
          <p className="text-sm text-brand-muted">None set up.</p>
        ) : (
          recurring.map((r, i) => (
            <Line key={i} left={`${r.category} · ${r.frequency}`} right={naira(Number(r.amount))} />
          ))
        )}
      </Section>

      <Section title="Unusual spending">
        {unusualBig.length === 0 && unusualCats.length === 0 ? (
          <p className="text-sm text-brand-muted">Nothing unusual — spending looks steady.</p>
        ) : (
          <>
            {unusualBig.map((e, i) => (
              <Line
                key={`b${i}`}
                left={`Large: ${e.description || e.category || "expense"}`}
                right={naira(Number(e.amount))}
                tint="text-orange-400"
              />
            ))}
            {unusualCats.map((c, i) => (
              <Line
                key={`c${i}`}
                left={`${c.cat} jumped vs ${b.prevLabel}`}
                right={`${naira(c.amt)} (was ${naira(c.prev)})`}
                tint="text-orange-400"
              />
            ))}
          </>
        )}
      </Section>

      <Section title="Savings progress">
        {goals.length === 0 ? (
          <p className="text-sm text-brand-muted">No savings goals yet.</p>
        ) : (
          <>
            <div className="mb-1 text-sm text-brand-muted">Total saved: {naira(savedTotal)}</div>
            {goals.map((g, i) => (
              <Line
                key={i}
                left={g.name}
                right={`${naira(g.current)} / ${naira(g.target)} (${g.target > 0 ? Math.round((g.current / g.target) * 100) : 0}%)`}
              />
            ))}
          </>
        )}
      </Section>
    </div>
  );
}

function Tile({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-brand-muted">{label}</div>
      <div className={`mt-1 text-lg font-bold ${tint}`}>{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="mb-2 text-sm font-semibold text-brand-muted">{title}</div>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  );
}
function Line({ left, right, tint }: { left: string; right: string; tint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="min-w-0 truncate">{left}</span>
      <span className={`whitespace-nowrap font-medium ${tint ?? "text-brand-muted"}`}>{right}</span>
    </div>
  );
}
function Empty() {
  return <p className="text-sm text-brand-muted">Nothing to show for this period.</p>;
}
