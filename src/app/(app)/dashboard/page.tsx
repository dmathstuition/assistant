import { createClient } from "@/lib/supabase/server";
import CommandBox from "@/components/CommandBox";
import QuickAdd from "@/components/QuickAdd";
import TaskItem from "@/components/TaskItem";
import Budgets, { type BudgetRow } from "@/components/Budgets";
import { naira } from "@/components/Naira";

export const dynamic = "force-dynamic";

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

type Row = { amount: number };
type ExpenseRow = { amount: number; category: string | null };
type Budget = { category: string; monthly_limit: number };
type Task = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  priority: string;
};

export default async function Dashboard() {
  const supabase = await createClient();
  const start = monthStart();

  const [{ data: exp }, { data: inc }, { data: tasks }, { data: budgetRows }] =
    await Promise.all([
      supabase
        .from("expenses")
        .select("amount,category")
        .gte("occurred_on", start),
      supabase.from("income").select("amount").gte("occurred_on", start),
      supabase
        .from("tasks")
        .select("id,title,status,due_date,priority")
        .neq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase.from("budgets").select("category,monthly_limit"),
    ]);

  const expenses = (exp as ExpenseRow[]) ?? [];
  const totalExp = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const totalInc = ((inc as Row[]) ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const net = totalInc - totalExp;
  const taskList = (tasks as Task[]) ?? [];

  // Spent-this-month per category, keyed case-insensitively to match budgets.
  const spentByCategory = new Map<string, number>();
  for (const e of expenses) {
    const key = (e.category ?? "Other").toLowerCase();
    spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + Number(e.amount));
  }
  const budgets: BudgetRow[] = ((budgetRows as Budget[]) ?? []).map((b) => ({
    category: b.category,
    monthly_limit: Number(b.monthly_limit),
    spent: spentByCategory.get(b.category.toLowerCase()) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{greeting()}.</h1>
        <p className="text-sm text-brand-muted">
          {new Date().toLocaleDateString("en-NG", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Income this month" value={naira(totalInc)} />
        <Stat label="Expenses this month" value={naira(totalExp)} />
        <Stat
          label="Net this month"
          value={naira(net)}
          accent={net < 0 ? "text-red-400" : "text-green-400"}
        />
        <Stat label="Open tasks" value={String(taskList.length)} />
      </div>

      <CommandBox />

      <div className="grid gap-6 lg:grid-cols-2">
        <QuickAdd />

        <div className="card p-5">
          <div className="mb-3 text-sm font-semibold text-brand-muted">
            Open tasks
          </div>
          {taskList.length === 0 ? (
            <p className="text-sm text-brand-muted">
              Nothing yet. Add a task, or ask the assistant.
            </p>
          ) : (
            <div className="divide-y divide-brand-border">
              {taskList.map((t) => (
                <TaskItem key={t.id} {...t} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Budgets budgets={budgets} />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs text-brand-muted">{label}</div>
      <div className={`mt-1 text-lg font-bold ${accent ?? ""}`}>{value}</div>
    </div>
  );
}
