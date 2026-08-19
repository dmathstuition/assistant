import { createClient } from "@/lib/supabase/server";
import TaskItem from "@/components/TaskItem";
import AddTaskForm from "@/components/AddTaskForm";
import { CalendarIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

type Task = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  due_time: string | null;
  priority: string;
};

function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default async function PlannerPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("tasks")
    .select("id,title,status,due_date,due_time,priority")
    .neq("status", "completed")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("due_time", { ascending: true, nullsFirst: true });

  const tasks = (data as Task[]) ?? [];
  const today = isoDate(0);
  const weekEnd = isoDate(7);

  const groups: { key: string; title: string; items: Task[] }[] = [
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

  for (const t of tasks) {
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

      <AddTaskForm />

      {tasks.length === 0 ? (
        <div className="card p-5 text-sm text-brand-muted">
          Nothing planned yet. Add a task above, or ask the assistant — e.g.
          &ldquo;remind me to submit results on 30 September&rdquo;.
        </div>
      ) : (
        <div className="space-y-5">
          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <div key={g.key} className="card p-5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold text-brand-muted">
                    {g.title}
                  </div>
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
                    <TaskItem key={t.id} {...t} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
