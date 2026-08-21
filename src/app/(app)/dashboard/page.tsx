import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CommandBox from "@/components/CommandBox";
import QuickAdd from "@/components/QuickAdd";
import TaskCard, { type FullTask } from "@/components/TaskCard";
import Budgets, { type BudgetRow } from "@/components/Budgets";
import SavingsGoals, { type GoalRow } from "@/components/SavingsGoals";
import ExportButton from "@/components/ExportButton";
import ImportCsv from "@/components/ImportCsv";
import PinSettings from "@/components/PinSettings";
import NotificationToggle from "@/components/NotificationToggle";
import RecurringRules, { type RuleRow } from "@/components/RecurringRules";
import DownloadAppButton from "@/components/DownloadAppButton";
import SpendingDonut, { type Slice } from "@/components/SpendingDonut";
import TrendChart, { type MonthPoint } from "@/components/TrendChart";
import { naira } from "@/components/Naira";
import {
  IncomeIcon,
  WalletIcon,
  TrendingUpIcon,
  CalendarIcon,
  ClockIcon,
  BellIcon,
  ListIcon,
  PlusIcon,
  PiggyIcon,
  GaugeIcon,
  SearchIcon,
  ReportIcon,
} from "@/components/icons";

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

type ExpenseRow = { amount: number; category: string | null; occurred_on: string };
type IncomeMonthRow = { amount: number; occurred_on: string; source_name: string | null };
type DatedRow = { amount: number; occurred_on: string };
type Budget = { id: string; category: string; monthly_limit: number };

const TASK_SELECT =
  "id,title,description,category,priority,status,due_date,due_time,recurrence,reminder_minutes,notes";

export default async function Dashboard() {
  const supabase = await createClient();
  const start = monthStart();
  const today = new Date().toISOString().slice(0, 10);
  const nowISO = new Date().toISOString();

  const trendStart = windowStart(6);
  const [
    { data: exp },
    { data: inc },
    { data: todayRows },
    { data: overdueRows },
    { data: reminderRows },
    { data: budgetRows },
    { data: goalRows },
    { data: expTrend },
    { data: incTrend },
    { data: ruleRows },
  ] = await Promise.all([
      supabase
        .from("expenses")
        .select("amount,category,occurred_on")
        .gte("occurred_on", start),
      supabase
        .from("income")
        .select("amount,occurred_on,source_name")
        .gte("occurred_on", start),
      supabase
        .from("tasks")
        .select(TASK_SELECT)
        .eq("due_date", today)
        .in("status", ["pending", "in_progress"])
        .order("due_time", { ascending: true, nullsFirst: false }),
      supabase
        .from("tasks")
        .select(TASK_SELECT)
        .lt("due_date", today)
        .in("status", ["pending", "in_progress"])
        .order("due_date", { ascending: true })
        .limit(20),
      supabase
        .from("reminders")
        .select("id,title,remind_at")
        .eq("is_done", false)
        .gte("remind_at", nowISO)
        .order("remind_at", { ascending: true })
        .limit(6),
      supabase.from("budgets").select("id,category,monthly_limit"),
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
      supabase
        .from("recurring_rules")
        .select("id,kind,amount,category,frequency,next_run")
        .order("next_run", { ascending: true }),
    ]);

  const expenses = (exp as ExpenseRow[]) ?? [];
  const incomeRows = (inc as IncomeMonthRow[]) ?? [];
  const totalExp = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const totalInc = incomeRows.reduce((s, r) => s + Number(r.amount), 0);
  const net = totalInc - totalExp;

  const todaySpent = expenses
    .filter((r) => r.occurred_on === today)
    .reduce((s, r) => s + Number(r.amount), 0);
  const todayIncome = incomeRows
    .filter((r) => r.occurred_on === today)
    .reduce((s, r) => s + Number(r.amount), 0);

  // Autocomplete values from this month's own entries.
  const pastCategories = [
    ...new Set(expenses.map((e) => e.category).filter((c): c is string => Boolean(c))),
  ];
  const pastSources = [
    ...new Set(
      incomeRows.map((i) => i.source_name).filter((s): s is string => Boolean(s)),
    ),
  ];

  const todayTasks = (todayRows as FullTask[]) ?? [];
  const overdueTasks = (overdueRows as FullTask[]) ?? [];
  const reminders = (reminderRows as { id: string; title: string; remind_at: string }[]) ?? [];
  const schedule = todayTasks.filter((t) => t.due_time);
  const priorities = [...overdueTasks, ...todayTasks]
    .filter((t) => t.priority === "critical" || t.priority === "high")
    .slice(0, 5);
  const openToday = todayTasks.length + overdueTasks.length;

  // Spent-this-month per category, keyed case-insensitively to match budgets.
  const spentByCategory = new Map<string, number>();
  for (const e of expenses) {
    const key = (e.category ?? "Other").toLowerCase();
    spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + Number(e.amount));
  }
  const budgets: BudgetRow[] = ((budgetRows as Budget[]) ?? []).map((b) => ({
    id: b.id,
    category: b.category,
    monthly_limit: Number(b.monthly_limit),
    spent: spentByCategory.get(b.category.toLowerCase()) ?? 0,
  }));

  const goals: GoalRow[] = ((goalRows as GoalRow[]) ?? []).map((g) => ({
    ...g,
    target_amount: Number(g.target_amount),
    current_amount: Number(g.current_amount),
  }));

  const savedTotal = goals.reduce((s, g) => s + g.current_amount, 0);
  const alerts = budgets
    .filter((b) => b.monthly_limit > 0 && b.spent / b.monthly_limit >= 0.8)
    .map((b) => ({
      category: b.category,
      pct: Math.round((b.spent / b.monthly_limit) * 100),
      over: b.spent > b.monthly_limit,
    }));

  // The budget under most pressure, for the daily brief.
  const topBudget = budgets
    .filter((b) => b.monthly_limit > 0)
    .map((b) => ({
      category: b.category,
      remaining: b.monthly_limit - b.spent,
      pct: b.spent / b.monthly_limit,
    }))
    .sort((a, b) => b.pct - a.pct)[0];

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

  const rules: RuleRow[] = ((ruleRows as RuleRow[]) ?? []).map((r) => ({
    ...r,
    amount: Number(r.amount),
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

      <DownloadAppButton />

      {/* Daily brief */}
      <div className="card p-4 text-sm">
        <span className="text-brand-muted">Here&apos;s your day — </span>
        <b>{todayTasks.length}</b>
        <span className="text-brand-muted">
          {" "}
          task{todayTasks.length === 1 ? "" : "s"} due
        </span>
        {overdueTasks.length > 0 && (
          <span className="text-red-400"> ({overdueTasks.length} overdue)</span>
        )}
        <span className="text-brand-muted"> · spent </span>
        <b className="text-brand-accent">{naira(todaySpent)}</b>
        <span className="text-brand-muted"> today</span>
        {todayIncome > 0 && (
          <>
            <span className="text-brand-muted"> · earned </span>
            <b className="text-green-400">{naira(todayIncome)}</b>
          </>
        )}
        {topBudget && (
          <>
            <span className="text-brand-muted"> · {topBudget.category}: </span>
            <b className={topBudget.remaining < 0 ? "text-red-400" : "text-green-400"}>
              {topBudget.remaining < 0
                ? `${naira(-topBudget.remaining)} over`
                : `${naira(topBudget.remaining)} left`}
            </b>
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <QuickAction href="/planner" label="Add task">
          <PlusIcon />
        </QuickAction>
        <QuickAction href="/analytics" label="Stats">
          <TrendingUpIcon />
        </QuickAction>
        <QuickAction href="/insights" label="Insights">
          <GaugeIcon />
        </QuickAction>
        <QuickAction href="/report" label="Report">
          <ReportIcon />
        </QuickAction>
        <QuickAction href="/search" label="Search">
          <SearchIcon />
        </QuickAction>
        <QuickAction href="/reminders" label="Alerts">
          <BellIcon />
        </QuickAction>
        <QuickAction href="/accounts" label="Bank">
          <WalletIcon />
        </QuickAction>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Income this month" value={naira(totalInc)} icon={<IncomeIcon />} tint="text-green-400" />
        <Stat label="Expenses this month" value={naira(totalExp)} icon={<WalletIcon />} tint="text-brand-accent" />
        <Stat
          label="Net this month"
          value={naira(net)}
          accent={net < 0 ? "text-red-400" : "text-green-400"}
          icon={<TrendingUpIcon />}
          tint={net < 0 ? "text-red-400" : "text-green-400"}
        />
        <Stat label="Saved" value={naira(savedTotal)} icon={<PiggyIcon />} tint="text-sky-400" />
      </div>

      {/* Today + reminders/alerts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-muted">
              <CalendarIcon className="text-base text-brand-accent" />
              Today
              {openToday > 0 && (
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs">{openToday}</span>
              )}
            </div>
            <Link href="/planner" className="text-xs text-brand-accent hover:underline">
              Planner →
            </Link>
          </div>

          {overdueTasks.length > 0 && (
            <div className="mb-2">
              <div className="mb-1 text-xs font-semibold text-red-400">
                Overdue ({overdueTasks.length})
              </div>
              <div className="divide-y divide-white/5">
                {overdueTasks.slice(0, 4).map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </div>
            </div>
          )}

          {schedule.length > 0 && (
            <div className="mb-1 mt-2 flex items-center gap-1 text-xs font-semibold text-brand-muted">
              <ClockIcon className="text-xs" /> Schedule
            </div>
          )}
          {todayTasks.length === 0 ? (
            <p className="text-sm text-brand-muted">Nothing due today. Enjoy — or plan ahead.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {todayTasks.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          )}

          {priorities.length > 0 && (
            <div className="mt-3 border-t border-white/5 pt-3">
              <div className="mb-1 text-xs font-semibold text-brand-muted">Top priorities</div>
              <ul className="space-y-1 text-sm">
                {priorities.map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${t.priority === "critical" ? "bg-red-500" : "bg-orange-500"}`}
                    />
                    <span className="truncate">{t.title}</span>
                    {t.due_date && t.due_date < today && (
                      <span className="ml-auto text-xs text-red-400">overdue</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-muted">
              <BellIcon className="text-base text-brand-accent" />
              Reminders & alerts
            </div>
            <Link href="/reminders" className="text-xs text-brand-accent hover:underline">
              Manage →
            </Link>
          </div>

          <div className="mb-1 text-xs font-semibold text-brand-muted">Upcoming reminders</div>
          {reminders.length === 0 ? (
            <p className="text-sm text-brand-muted">No upcoming reminders.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {reminders.map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" />
                  <span className="truncate">{r.title}</span>
                  <span className="ml-auto whitespace-nowrap text-xs text-brand-muted">
                    {new Date(r.remind_at).toLocaleString("en-NG", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mb-1 mt-4 text-xs font-semibold text-brand-muted">Financial alerts</div>
          {alerts.length === 0 ? (
            <p className="text-sm text-brand-muted">All budgets healthy. 👍</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {alerts.map((a) => (
                <li key={a.category} className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${a.over ? "bg-red-500" : "bg-orange-500"}`} />
                  <span className="truncate">{a.category}</span>
                  <span className={`ml-auto text-xs ${a.over ? "text-red-400" : "text-orange-400"}`}>
                    {a.pct}% {a.over ? "over" : "used"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <CommandBox />

      <div className="grid gap-6 lg:grid-cols-2">
        <SpendingDonut slices={slices} />
        <TrendChart months={trend} />
      </div>

      <QuickAdd categories={pastCategories} sources={pastSources} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Budgets budgets={budgets} />
        <SavingsGoals goals={goals} />
      </div>

      <RecurringRules rules={rules} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ExportButton />
        <ImportCsv />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <NotificationToggle />
        <PinSettings />
      </div>
    </div>
  );
}

function QuickAction({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="btn-ghost flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-brand-muted hover:text-brand-fg"
    >
      <span className="text-base text-brand-accent">{children}</span>
      {label}
    </Link>
  );
}

function Stat({
  label,
  value,
  accent,
  icon,
  tint,
}: {
  label: string;
  value: string;
  accent?: string;
  icon?: React.ReactNode;
  tint?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs text-brand-muted">
        {icon && <span className={`text-base ${tint ?? ""}`}>{icon}</span>}
        {label}
      </div>
      <div className={`mt-1 text-lg font-bold ${accent ?? ""}`}>{value}</div>
    </div>
  );
}
