import { createClient } from "@/lib/supabase/server";
import { naira } from "@/components/Naira";
import DebtManager, { type DebtRow } from "@/components/DebtManager";
import MonthPicker from "@/components/MonthPicker";
import { DebtIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

function recentMonths(n: number) {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export default async function DebtsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const months = recentMonths(12);
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : months[0];

  const supabase = await createClient();

  // Debts for the chosen month.
  const { data: debtData } = await supabase
    .from("debts")
    .select("id,creditor,amount,amount_paid,month,due_on,notes")
    .eq("month", month)
    .order("created_at", { ascending: false });
  const debts: DebtRow[] = (debtData ?? []).map((d) => ({
    id: d.id,
    creditor: d.creditor,
    amount: Number(d.amount),
    amount_paid: Number(d.amount_paid),
    month: d.month,
    due_on: d.due_on,
    notes: d.notes,
  }));

  // Income for the same month → debt-to-income rate.
  const start = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const { data: incData } = await supabase
    .from("income")
    .select("amount")
    .gte("occurred_on", start)
    .lt("occurred_on", next);
  const income = (incData ?? []).reduce((s, r) => s + Number(r.amount), 0);

  const totalOwed = debts.reduce((s, d) => s + d.amount, 0);
  const totalPaid = debts.reduce((s, d) => s + d.amount_paid, 0);
  const outstanding = Math.max(totalOwed - totalPaid, 0);
  const paidPct = totalOwed > 0 ? Math.round((totalPaid / totalOwed) * 100) : 0;
  const debtRate = income > 0 ? Math.round((totalOwed / income) * 100) : null;

  const rateTint =
    debtRate === null
      ? "text-brand-muted"
      : debtRate <= 35
        ? "text-green-400"
        : debtRate <= 50
          ? "text-amber-300"
          : "text-red-400";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <DebtIcon className="text-xl text-brand-accent" />
          <h1 className="text-xl font-semibold">Debts</h1>
        </div>
        <MonthPicker path="/debts" months={months} current={month} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Owed" value={naira(totalOwed)} tint="text-brand-accent" />
        <Stat label="Paid" value={naira(totalPaid)} tint="text-green-400" />
        <Stat
          label="Outstanding"
          value={naira(outstanding)}
          tint={outstanding > 0 ? "text-red-400" : "text-green-400"}
        />
        <Stat
          label="Debt rate"
          value={debtRate === null ? "—" : `${debtRate}%`}
          tint={rateTint}
          sub={debtRate === null ? "add income" : "of income"}
        />
      </div>

      <div className="card p-4 text-sm text-brand-muted">
        You&apos;ve cleared <b className="text-brand-fg">{paidPct}%</b> of this month&apos;s
        debt.{" "}
        {debtRate !== null && (
          <>
            Your debt is <b className={rateTint}>{debtRate}%</b> of your {month} income
            ({naira(income)}). {debtRate <= 35
              ? "That's a healthy level."
              : debtRate <= 50
                ? "Keep an eye on it."
                : "That's high — prioritise paying it down."}
          </>
        )}
      </div>

      <DebtManager debts={debts} month={month} />
    </div>
  );
}

function Stat({
  label,
  value,
  tint,
  sub,
}: {
  label: string;
  value: string;
  tint: string;
  sub?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs text-brand-muted">{label}</div>
      <div className={`mt-1 text-lg font-bold ${tint}`}>{value}</div>
      {sub && <div className="text-[11px] text-brand-muted">{sub}</div>}
    </div>
  );
}
