import { createClient } from "@/lib/supabase/server";
import TaskForm from "@/components/TaskForm";
import TaskCard, { type FullTask } from "@/components/TaskCard";
import { CalendarIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const SELECT =
  "id,title,description,category,priority,status,due_date,due_time,recurrence,reminder_minutes,notes";

function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default async function PlannerPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("tasks")
    .select(SELECT)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("due_time", { ascending: true, nullsFirst: true });

  const all = (data as FullTask[]) ?? [];
  const active = all.filter((t) => t.status === "pending" || t.status === "in_progress");
  const doneOrCancelled = all.filter(
    (t) => t.status === "completed" || t.status === "cancelled",
  );

  const today = isoDate(0);
  const weekEnd = isoDate(7);

  const groups: { key: string; title: string; items: FullTask[] }[] = [
    { key: "overdue", title: "Overdue", items: [] },
    { key: "today", title: "Today", items: [] },
    { key: "soon", title: "Next 7 days", items: [] },
    { key: "later", title: "Later", items: [] },
    { key: "someday", title: "No date", items: [] },
  ];
  const by = Object.fromEntries(groups.map((g) => [g.key, g])) as Record<
    string,
    (typeof groups)[number]
  >;
  for (const t of active) {
    if (!t.due_date) by.someday.items.push(t);
    else if (t.due_date < today) by.overdue.items.push(t);
    else if (t.due_date === today) by.today.items.push(t);
    else if (t.due_date <= weekEnd) by.soon.items.push(t);
    else by.later.items.push(t);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <CalendarIcon className="text-xl text-brand-accent" />
        <h1 className="text-xl font-semibold">Planner</h1>
      </div>

      <div className="card p-5">
        <div className="mb-3 text-sm font-semibold text-brand-muted">Add a task</div>
        <TaskForm />
      </div>

      {active.length === 0 ? (
        <div className="card p-5 text-sm text-brand-muted">
          No open tasks. Add one above, or ask the assistant — e.g. &ldquo;remind me
          to submit results on 30 September at 5pm&rdquo;.
        </div>
      ) : (
        groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <div key={g.key} className="card p-5">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-sm font-semibold text-brand-muted">{g.title}</div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    g.key === "overdue"
                      ? "bg-red-500/15 text-red-400"
                      : "bg-white/5 text-brand-muted"
                  }`}
                >
                  {g.items.length}
                </span>
              </div>
              <div className="divide-y divide-white/5">
                {g.items.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </div>
            </div>
          ))
      )}

      {doneOrCancelled.length > 0 && (
        <details className="card p-5">
          <summary className="cursor-pointer text-sm font-semibold text-brand-muted">
            Completed & cancelled ({doneOrCancelled.length})
          </summary>
          <div className="mt-2 divide-y divide-white/5">
            {doneOrCancelled.slice(0, 40).map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
