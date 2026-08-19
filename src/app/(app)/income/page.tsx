import { createClient } from "@/lib/supabase/server";
import { naira } from "@/components/Naira";
import IncomeForm from "@/components/IncomeForm";
import IncomeRow, { type IncomeEntry } from "@/components/IncomeRow";
import { IncomeIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const SELECT = "id,amount,source_name,category,account,description,notes,occurred_on";

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-NG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function IncomePage() {
  const supabase = await createClient();
  const monthStart = new Date();
  const mStart = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);

  const { data } = await supabase
    .from("income")
    .select(SELECT)
    .order("occurred_on", { ascending: false })
    .limit(200);

  const rows = ((data as IncomeEntry[]) ?? []).map((r) => ({
    ...r,
    amount: Number(r.amount),
  }));

  const thisMonth = rows
    .filter((r) => r.occurred_on >= mStart)
    .reduce((s, r) => s + r.amount, 0);

  // Totals by type (category) this month.
  const byType = new Map<string, number>();
  for (const r of rows) {
    if (r.occurred_on >= mStart) {
      const k = r.category || r.source_name || "Other";
      byType.set(k, (byType.get(k) ?? 0) + r.amount);
    }
  }
  const topType = [...byType.entries()].sort((a, b) => b[1] - a[1])[0];

  // Group all rows by month.
  const groups = new Map<string, IncomeEntry[]>();
  for (const r of rows) {
    const key = r.occurred_on.slice(0, 7);
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <IncomeIcon className="text-xl text-green-400" />
        <h1 className="text-xl font-semibold">Income</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs text-brand-muted">This month</div>
          <div className="mt-1 text-lg font-bold text-green-400">{naira(thisMonth)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-brand-muted">Top source</div>
          <div className="mt-1 text-lg font-bold">{topType ? topType[0] : "—"}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-brand-muted">Entries</div>
          <div className="mt-1 text-lg font-bold">{rows.length}</div>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-muted">
          <IncomeIcon className="text-base text-green-400" />
          Record income
        </div>
        <IncomeForm />
      </div>

      {rows.length === 0 ? (
        <div className="card p-5 text-sm text-brand-muted">
          No income recorded yet. Add your first above, or say it to the assistant —
          e.g. &ldquo;I earned ₦250,000 from teaching&rdquo;.
        </div>
      ) : (
        [...groups.entries()].map(([key, list]) => {
          const total = list.reduce((s, r) => s + r.amount, 0);
          return (
            <div key={key} className="card p-5">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-sm font-semibold text-brand-muted">{monthLabel(key)}</div>
                <span className="text-sm font-semibold text-green-400">{naira(total)}</span>
              </div>
              <div className="divide-y divide-white/5">
                {list.map((r) => (
                  <IncomeRow key={r.id} entry={r} />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
