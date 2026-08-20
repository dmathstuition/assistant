import { createClient } from "@/lib/supabase/server";
import { naira } from "@/components/Naira";
import ScoreRing from "@/components/ScoreRing";
import { GaugeIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

type Exp = { amount: number; category: string | null; description: string | null };

function monthBounds(offset = 0) {
  const d = new Date();
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset + 1, 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
const sum = (rows: { amount: number | string }[] | null) =>
  (rows ?? []).reduce((t, r) => t + (Number(r.amount) || 0), 0);

type Insight = { tone: "good" | "warn" | "bad" | "info"; text: string };

export default async function InsightsPage() {
  const supabase = await createClient();
  const now = monthBounds(0);
  const prev = monthBounds(-1);

  const [
    { data: expNow },
    { data: incNow },
    { data: expPrev },
    { data: incPrev },
    { data: budgetRows },
    { data: goalRows },
  ] = await Promise.all([
    supabase.from("expenses").select("amount,category,description").gte("occurred_on", now.start).lt("occurred_on", now.end),
    supabase.from("income").select("amount").gte("occurred_on", now.start).lt("occurred_on", now.end),
    supabase.from("expenses").select("amount").gte("occurred_on", prev.start).lt("occurred_on", prev.end),
    supabase.from("income").select("amount").gte("occurred_on", prev.start).lt("occurred_on", prev.end),
    supabase.from("budgets").select("category,monthly_limit"),
    supabase.from("savings_goals").select("current_amount,target_amount"),
  ]);

  const expenses = (expNow as Exp[]) ?? [];
  const income = sum(incNow);
  const spent = sum(expenses);
  const net = income - spent;
  const savingsRate = income > 0 ? net / income : 0;

  const lastSpent = sum(expPrev);
  const lastIncome = sum(incPrev);

  // Spend by category (this month).
  const byCat = new Map<string, number>();
  for (const e of expenses) {
    const k = e.category ?? "Other";
    byCat.set(k, (byCat.get(k) ?? 0) + Number(e.amount));
  }
  const topCat = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];

  // Budget adherence.
  const budgets = ((budgetRows as { category: string; monthly_limit: number }[]) ?? []).map((b) => {
    const s = byCat.get(b.category) ?? 0;
    return { category: b.category, limit: Number(b.monthly_limit), spent: s };
  });
  const overBudget = budgets.filter((b) => b.limit > 0 && b.spent > b.limit);
  const withinBudget = budgets.filter((b) => b.limit > 0 && b.spent <= b.limit);

  const goals = ((goalRows as { current_amount: number; target_amount: number }[]) ?? []).map((g) => ({
    current: Number(g.current_amount),
    target: Number(g.target_amount),
  }));
  const savedTotal = goals.reduce((s, g) => s + g.current, 0);
  const goalTarget = goals.reduce((s, g) => s + g.target, 0);

  // ---- Health score (0–100) ----
  let score = 0;
  // Savings rate → up to 40
  score += Math.max(0, Math.min(1, savingsRate / 0.3)) * 40;
  // Budget adherence → up to 30 (neutral 15 if no budgets set)
  score +=
    budgets.length > 0 ? (withinBudget.length / budgets.length) * 30 : 15;
  // Spending within income → up to 20
  score += income > 0 ? (spent <= income ? 20 : Math.max(0, 20 * (1 - (spent - income) / income))) : 0;
  // Working toward goals → 10
  score += savedTotal > 0 ? 10 : 0;
  const scoreLabel =
    score >= 75 ? "Excellent" : score >= 50 ? "Good" : score >= 25 ? "Fair" : "Needs work";

  // ---- Insights ----
  const insights: Insight[] = [];
  if (lastSpent > 0) {
    const change = Math.round(((spent - lastSpent) / lastSpent) * 100);
    if (change > 5)
      insights.push({ tone: "warn", text: `Spending is up ${change}% vs last month (${naira(spent)} vs ${naira(lastSpent)}).` });
    else if (change < -5)
      insights.push({ tone: "good", text: `Spending is down ${Math.abs(change)}% vs last month — nice.` });
    else insights.push({ tone: "info", text: `Spending is about the same as last month.` });
  }
  if (income > 0)
    insights.push({
      tone: savingsRate >= 0.2 ? "good" : savingsRate >= 0.05 ? "info" : "warn",
      text: `You're saving ${Math.round(savingsRate * 100)}% of your income this month.`,
    });
  else if (spent > 0)
    insights.push({ tone: "warn", text: "No income logged this month yet — add it for a real savings picture." });
  if (topCat)
    insights.push({
      tone: "info",
      text: `${topCat[0]} is your biggest expense — ${naira(topCat[1])} (${Math.round((topCat[1] / (spent || 1)) * 100)}% of spend).`,
    });
  if (overBudget.length > 0)
    insights.push({ tone: "bad", text: `You're over budget on ${overBudget.map((b) => b.category).join(", ")}.` });
  else if (budgets.length > 0)
    insights.push({ tone: "good", text: "All your budgets are on track this month." });
  const biggest = expenses.slice().sort((a, b) => Number(b.amount) - Number(a.amount))[0];
  if (biggest)
    insights.push({
      tone: "info",
      text: `Largest single expense: ${naira(Number(biggest.amount))}${biggest.description ? ` on ${biggest.description}` : biggest.category ? ` (${biggest.category})` : ""}.`,
    });
  if (goalTarget > 0)
    insights.push({
      tone: "info",
      text: `You've saved ${naira(savedTotal)} of ${naira(goalTarget)} toward your goals (${Math.round((savedTotal / goalTarget) * 100)}%).`,
    });
  if (lastIncome > 0 && income > lastIncome)
    insights.push({ tone: "good", text: `Income is up vs last month (${naira(income)} vs ${naira(lastIncome)}).` });

  const toneStyle: Record<Insight["tone"], string> = {
    good: "text-green-400",
    warn: "text-orange-400",
    bad: "text-red-400",
    info: "text-sky-400",
  };
  const toneDot: Record<Insight["tone"], string> = {
    good: "bg-green-400",
    warn: "bg-orange-400",
    bad: "bg-red-400",
    info: "bg-sky-400",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <GaugeIcon className="text-xl text-brand-accent" />
        <h1 className="text-xl font-semibold">Insights</h1>
      </div>

      <div className="card flex flex-col items-center gap-4 p-5 sm:flex-row sm:items-center">
        <ScoreRing score={score} label={scoreLabel} />
        <div className="flex-1">
          <div className="text-sm font-semibold text-brand-muted">Financial health</div>
          <p className="mt-1 text-sm text-brand-muted">
            A quick read on this month from your savings rate, budget adherence,
            spending vs income, and goal progress.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Fact label="Income" value={naira(income)} tint="text-green-400" />
            <Fact label="Spent" value={naira(spent)} tint="text-brand-accent" />
            <Fact label="Net" value={naira(net)} tint={net < 0 ? "text-red-400" : "text-green-400"} />
            <Fact label="Savings rate" value={`${Math.round(savingsRate * 100)}%`} tint={savingsRate < 0 ? "text-red-400" : "text-green-400"} />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-3 text-sm font-semibold text-brand-muted">What stands out</div>
        {insights.length === 0 ? (
          <p className="text-sm text-brand-muted">
            Add a few expenses and income this month and insights will appear here.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {insights.map((it, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneDot[it.tone]}`} />
                <span className={toneStyle[it.tone]}>{it.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="well rounded-lg p-2.5">
      <div className="text-xs text-brand-muted">{label}</div>
      <div className={`mt-0.5 font-bold ${tint}`}>{value}</div>
    </div>
  );
}
