import { createClient } from "@/lib/supabase/server";
import CommandBox from "@/components/CommandBox";
import QuickAdd from "@/components/QuickAdd";
import TaskItem from "@/components/TaskItem";
import Budgets, { type BudgetRow } from "@/components/Budgets";
import SavingsGoals, { type GoalRow } from "@/components/SavingsGoals";
import ExportButton from "@/components/ExportButton";
import ImportCsv from "@/components/ImportCsv";
import PinSettings from "@/components/PinSettings";
import SpendingDonut, { type Slice } from "@/components/SpendingDonut";
import TrendChart, { type MonthPoint } from "@/components/TrendChart";
import { naira } from "@/components/Naira";

export const dynamic = "force-dynamic";

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

// First day of the month N-1 months ago (so a 6-window includes this month).
function windowStart(months: number) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - (months - 1), 1)
    .toISOString()
    .slice(0, 10);
}

// Build empty buckets for the last N months, newest last, keyed "YYYY-MM".
function monthBuckets(months: number) {
  const out: { key: string; label: string; income: number; expense: number }[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-NG", { month: "short" }),
      income: 0,
      expense: 0,
    });
  }
  return out;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

type Row = { amount: number };
type ExpenseRow = { amount: number; category: string | null };
type DatedRow = { amount: number; occurred_on: string };
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

  const trendStart = windowStart(6);
  const [
    { data: exp },
    { data: inc },
    { data: tasks },
    { data: budgetRows },
    { data: goalRows },
    { data: expTrend },
    { data: incTrend },
  ] = await Promise.all([
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
      supabase
        .from("savings_goals")
        .select("id,name,target_amount,current_amount,deadline")
        .order("created_at", { ascending: false }),
      supabase
        .from("expenses")
        .select("amount,occurred_on")
        .gte("occurred_on", trendStart),
      supabase
        .from("income")
        .select("amount,occurred_on")
        .gte("occurred_on", trendStart),
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

  const goals: GoalRow[] = ((goalRows as GoalRow[]) ?? []).map((g) => ({
    ...g,
    target_amount: Number(g.target_amount),
    current_amount: Number(g.current_amount),
  }));

  // Donut slices: this-month spend per category, keeping first-seen casing.
  const sliceMap = new Map<string, Slice>();
  for (const e of expenses) {
    const name = e.category ?? "Other";
    const key = name.toLowerCase();
    const prev = sliceMap.get(key);
    if (prev) prev.amount += Number(e.amount);
    else sliceMap.set(key, { category: name, amount: Number(e.amount) });
  }
  const slices: Slice[] = [...sliceMap.values()];

  // Trend: bucket the last 6 months of income and expenses.
  const buckets = monthBuckets(6);
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const e of (expTrend as DatedRow[]) ?? []) {
    const b = byKey.get(e.occurred_on.slice(0, 7));
    if (b) b.expense += Number(e.amount);
  }
  for (const i of (incTrend as DatedRow[]) ?? []) {
    const b = byKey.get(i.occurred_on.slice(0, 7));
    if (b) b.income += Number(i.amount);
  }
  const trend: MonthPoint[] = buckets.map((b) => ({
    label: b.label,
    income: b.income,
    expense: b.expense,
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
        <SpendingDonut slices={slices} />
        <TrendChart months={trend} />
      </div>

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

      <div className="grid gap-6 lg:grid-cols-2">
        <Budgets budgets={budgets} />
        <SavingsGoals goals={goals} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ExportButton />
        <ImportCsv />
      </div>

      <PinSettings />
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
