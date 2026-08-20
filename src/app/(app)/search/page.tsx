import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/components/Naira";
import SearchBox from "@/components/SearchBox";
import {
  SearchIcon,
  WalletIcon,
  IncomeIcon,
  ChecklistIcon,
  BellIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

// Escape a user query for a PostgREST ilike pattern (% and _ are wildcards).
function like(q: string) {
  return `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const supabase = await createClient();

  let expenses: { id: string; amount: number; category: string | null; description: string | null; occurred_on: string }[] = [];
  let income: { id: string; amount: number; source_name: string | null; description: string | null; occurred_on: string }[] = [];
  let tasks: { id: string; title: string; status: string; due_date: string | null }[] = [];
  let reminders: { id: string; title: string; remind_at: string }[] = [];

  if (query) {
    const p = like(query);
    const [e, i, t, r] = await Promise.all([
      supabase
        .from("expenses")
        .select("id,amount,category,description,occurred_on")
        .or(`category.ilike.${p},description.ilike.${p}`)
        .order("occurred_on", { ascending: false })
        .limit(25),
      supabase
        .from("income")
        .select("id,amount,source_name,description,occurred_on")
        .or(`source_name.ilike.${p},description.ilike.${p}`)
        .order("occurred_on", { ascending: false })
        .limit(25),
      supabase
        .from("tasks")
        .select("id,title,status,due_date")
        .or(`title.ilike.${p},description.ilike.${p},notes.ilike.${p}`)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("reminders")
        .select("id,title,remind_at")
        .ilike("title", p)
        .order("remind_at", { ascending: false })
        .limit(25),
    ]);
    expenses = e.data ?? [];
    income = i.data ?? [];
    tasks = t.data ?? [];
    reminders = r.data ?? [];
  }

  const total = expenses.length + income.length + tasks.length + reminders.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <SearchIcon className="text-xl text-brand-accent" />
        <h1 className="text-xl font-semibold">Search</h1>
      </div>

      <SearchBox initial={query} />

      {!query ? (
        <p className="text-sm text-brand-muted">
          Type to search across your expenses, income, tasks and reminders.
        </p>
      ) : total === 0 ? (
        <div className="card p-5 text-sm text-brand-muted">
          No matches for &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <div className="space-y-5">
          {expenses.length > 0 && (
            <Section title="Expenses" href="/history" icon={<WalletIcon className="text-brand-accent" />}>
              {expenses.map((e) => (
                <Row key={e.id} left={e.category ?? "Expense"} sub={`${e.occurred_on}${e.description ? ` · ${e.description}` : ""}`} right={`−${naira(Number(e.amount))}`} tint="text-brand-accent" />
              ))}
            </Section>
          )}
          {income.length > 0 && (
            <Section title="Income" href="/income" icon={<IncomeIcon className="text-green-400" />}>
              {income.map((i) => (
                <Row key={i.id} left={i.source_name ?? "Income"} sub={`${i.occurred_on}${i.description ? ` · ${i.description}` : ""}`} right={`+${naira(Number(i.amount))}`} tint="text-green-400" />
              ))}
            </Section>
          )}
          {tasks.length > 0 && (
            <Section title="Tasks" href="/planner" icon={<ChecklistIcon className="text-sky-400" />}>
              {tasks.map((t) => (
                <Row key={t.id} left={t.title} sub={t.due_date ?? "no date"} right={t.status.replace("_", " ")} />
              ))}
            </Section>
          )}
          {reminders.length > 0 && (
            <Section title="Reminders" href="/reminders" icon={<BellIcon className="text-brand-accent" />}>
              {reminders.map((r) => (
                <Row key={r.id} left={r.title} sub={new Date(r.remind_at).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} right="" />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  href,
  icon,
  children,
}: {
  title: string;
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-brand-muted">
          <span className="text-base">{icon}</span>
          {title}
        </div>
        <Link href={href} className="text-xs text-brand-accent hover:underline">
          Open →
        </Link>
      </div>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  );
}

function Row({
  left,
  sub,
  right,
  tint,
}: {
  left: string;
  sub: string;
  right: string;
  tint?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm">{left}</div>
        <div className="truncate text-xs text-brand-muted">{sub}</div>
      </div>
      {right && (
        <div className={`ml-auto whitespace-nowrap text-sm font-semibold ${tint ?? "text-brand-muted"}`}>
          {right}
        </div>
      )}
    </div>
  );
}
