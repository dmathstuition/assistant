import { createClient } from "@/lib/supabase/server";
import { naira } from "@/components/Naira";
import HistoryControls from "@/components/HistoryControls";
import TransactionRow, { type Txn } from "@/components/TransactionRow";
import { ListIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

type ExpRow = {
  id: string;
  amount: number;
  category: string | null;
  description: string | null;
  occurred_on: string;
};
type IncRow = {
  id: string;
  amount: number;
  source_name: string | null;
  description: string | null;
  occurred_on: string;
};

// The last 12 month keys (YYYY-MM) for the filter dropdown.
function recentMonths(n: number) {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; month?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  // Month → [start, next) bounds, if a month filter is set.
  let start: string | null = null;
  let next: string | null = null;
  if (sp.month && /^\d{4}-\d{2}$/.test(sp.month)) {
    const [y, m] = sp.month.split("-").map(Number);
    start = `${sp.month}-01`;
    next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  }

  const wantExpense = sp.type !== "income";
  const wantIncome = sp.type !== "expense";

  const expQ = supabase
    .from("expenses")
    .select("id,amount,category,description,occurred_on")
    .order("occurred_on", { ascending: false });
  const incQ = supabase
    .from("income")
    .select("id,amount,source_name,description,occurred_on")
    .order("occurred_on", { ascending: false });
  if (start && next) {
    expQ.gte("occurred_on", start).lt("occurred_on", next);
    incQ.gte("occurred_on", start).lt("occurred_on", next);
  }
  if (sp.category) {
    expQ.ilike("category", sp.category);
    incQ.ilike("source_name", sp.category);
  }

  const [{ data: exp }, { data: inc }] = await Promise.all([
    wantExpense ? expQ : Promise.resolve({ data: [] as ExpRow[] }),
    wantIncome ? incQ : Promise.resolve({ data: [] as IncRow[] }),
  ]);

  const txns: Txn[] = [
    ...((exp as ExpRow[]) ?? []).map((e) => ({
      id: e.id,
      kind: "expense" as const,
      date: e.occurred_on,
      label: e.category ?? "Other",
      amount: Number(e.amount),
      description: e.description,
    })),
    ...((inc as IncRow[]) ?? []).map((i) => ({
      id: i.id,
      kind: "income" as const,
      date: i.occurred_on,
      label: i.source_name ?? "Other",
      amount: Number(i.amount),
      description: i.description,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const totalIn = txns.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
  const totalOut = txns.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ListIcon className="text-xl text-brand-accent" />
        <h1 className="text-xl font-semibold">History</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Mini label="In" value={naira(totalIn)} tint="text-green-400" />
        <Mini label="Out" value={naira(totalOut)} tint="text-brand-accent" />
        <Mini
          label="Net"
          value={naira(totalIn - totalOut)}
          tint={totalIn - totalOut < 0 ? "text-red-400" : "text-green-400"}
        />
      </div>

      <div className="card p-5">
        <HistoryControls months={recentMonths(12)} />
        {txns.length === 0 ? (
          <p className="text-sm text-brand-muted">
            No transactions match these filters.
          </p>
        ) : (
          <div className="divide-y divide-white/5">
            {txns.map((t) => (
              <TransactionRow key={`${t.kind}-${t.id}`} txn={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-brand-muted">{label}</div>
      <div className={`mt-1 text-lg font-bold ${tint}`}>{value}</div>
    </div>
  );
}
