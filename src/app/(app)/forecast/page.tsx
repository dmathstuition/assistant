import { createClient } from "@/lib/supabase/server";
import { naira } from "@/components/Naira";
import { TrendingUpIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

type Row = { amount: number; category: string | null; occurred_on: string };

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7);
}

export default async function ForecastPage() {
  const supabase = await createClient();

  // "Today" in Lagos, as YYYY-MM-DD.
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
  }).format(new Date());
  const [y, m, d] = todayStr.split("-").map(Number);
  const thisMonth = `${y}-${String(m).padStart(2, "0")}`;
  const daysInMonth = new Date(y, m, 0).getDate();
  const fraction = Math.min(Math.max(d / daysInMonth, 0.01), 1);

  // Pull this month + the previous 3 full months.
  const histStart = `${new Date(y, m - 4, 1).getFullYear()}-${String(
    new Date(y, m - 4, 1).getMonth() + 1,
  ).padStart(2, "0")}-01`;

  const [{ data: exp }, { data: inc }, { data: budgets }] = await Promise.all([
    supabase.from("expenses").select("amount,category,occurred_on").gte("occurred_on", histStart),
    supabase.from("income").select("amount,category,occurred_on").gte("occurred_on", histStart),
    supabase.from("budgets").select("category,monthly_limit"),
  ]);

  const expenses = (exp as Row[]) ?? [];
  const incomes = (inc as Row[]) ?? [];

  // Average of the previous (complete) months present in the data.
  function monthlyAverage(rows: Row[]) {
    const totals = new Map<string, number>();
    for (const r of rows) {
      const key = monthKey(r.occurred_on);
      if (key === thisMonth) continue; // exclude the in-progress month
      totals.set(key, (totals.get(key) ?? 0) + Number(r.amount));
    }
    if (totals.size === 0) return 0;
    return [...totals.values()].reduce((s, v) => s + v, 0) / totals.size;
  }

  const avgExp = monthlyAverage(expenses);
  const avgInc = monthlyAverage(incomes);

  const curExp = expenses
    .filter((r) => monthKey(r.occurred_on) === thisMonth)
    .reduce((s, r) => s + Number(r.amount), 0);
  const curInc = incomes
    .filter((r) => monthKey(r.occurred_on) === thisMonth)
    .reduce((s, r) => s + Number(r.amount), 0);

  const runRateExp = curExp / fraction;
  // Blend run-rate with the historical average when we have history.
  const projExp = avgExp > 0 ? Math.round(0.5 * runRateExp + 0.5 * avgExp) : Math.round(runRateExp);
  // Income tends to arrive in lumps — take the larger of received-so-far and history.
  const projInc = Math.round(Math.max(curInc, avgInc));
  const projNet = projInc - projExp;

  // Per-category projection vs budgets.
  const curByCat = new Map<string, number>();
  for (const r of expenses) {
    if (monthKey(r.occurred_on) !== thisMonth) continue;
    const c = r.category ?? "Other";
    curByCat.set(c, (curByCat.get(c) ?? 0) + Number(r.amount));
  }
  const projByCat = [...curByCat.entries()]
    .map(([category, cur]) => ({ category, projected: Math.round(cur / fraction), cur }))
    .sort((a, b) => b.projected - a.projected);

  const budgetMap = new Map<string, number>();
  for (const b of budgets ?? []) budgetMap.set(b.category, Number(b.monthly_limit));
  const risks = projByCat
    .filter((c) => budgetMap.has(c.category) && c.projected > (budgetMap.get(c.category) ?? Infinity))
    .map((c) => ({ ...c, limit: budgetMap.get(c.category) as number }));

  const haveHistory = avgExp > 0 || avgInc > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <TrendingUpIcon className="text-xl text-brand-accent" />
        <h1 className="text-xl font-semibold">Forecast</h1>
      </div>

      <p className="text-sm text-brand-muted">
        Projected month-end for <b className="text-brand-fg">{thisMonth}</b>, from{" "}
        {d} of {daysInMonth} days so far{haveHistory ? " blended with your recent months" : ""}.
      </p>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Proj. income" value={naira(projInc)} tint="text-green-400" />
        <Stat label="Proj. expenses" value={naira(projExp)} tint="text-brand-accent" />
        <Stat
          label="Proj. net"
          value={naira(projNet)}
          tint={projNet < 0 ? "text-red-400" : "text-green-400"}
        />
      </div>

      <div className="card p-5">
        <div className="mb-1 text-sm font-semibold">This month so far</div>
        <p className="text-sm text-brand-muted">
          Spent <b className="text-brand-accent">{naira(curExp)}</b>, earned{" "}
          <b className="text-green-400">{naira(curInc)}</b>. At this pace you&apos;ll{" "}
          {projNet < 0 ? (
            <>end <b className="text-red-400">{naira(-projNet)}</b> in the red.</>
          ) : (
            <>finish <b className="text-green-400">{naira(projNet)}</b> ahead.</>
          )}
        </p>
      </div>

      <div className="card p-5">
        <div className="mb-3 text-sm font-semibold">Budgets at risk</div>
        {risks.length === 0 ? (
          <p className="text-sm text-brand-muted">
            {budgetMap.size === 0
              ? "Set budgets to get over-spend warnings here."
              : "Nothing projected to blow its budget this month. 👍"}
          </p>
        ) : (
          <div className="space-y-2">
            {risks.map((r) => (
              <div key={r.category} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{r.category}</span>
                <span className="text-brand-muted">
                  proj. <b className="text-red-400">{naira(r.projected)}</b> / budget{" "}
                  {naira(r.limit)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="mb-3 text-sm font-semibold">Projected spend by category</div>
        {projByCat.length === 0 ? (
          <p className="text-sm text-brand-muted">No spending logged this month yet.</p>
        ) : (
          <div className="space-y-2">
            {projByCat.slice(0, 8).map((c) => (
              <div key={c.category} className="flex items-center justify-between gap-2 text-sm">
                <span>{c.category}</span>
                <span className="text-brand-muted">
                  {naira(c.cur)} so far → <b className="text-brand-fg">{naira(c.projected)}</b>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-brand-muted">{label}</div>
      <div className={`mt-1 text-base font-bold sm:text-lg ${tint}`}>{value}</div>
    </div>
  );
}
