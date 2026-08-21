import { createClient } from "@/lib/supabase/server";
import MonthPicker from "@/components/MonthPicker";
import { CalendarIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

function recentMonths(n: number) {
  const out: string[] = [];
  const now = new Date();
  // Show a window centred a little ahead so upcoming months are reachable.
  for (let i = 2; i > -n; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

// Format a timestamptz to Lagos-local YYYY-MM-DD and HH:mm.
const fmtDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Lagos",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const fmtTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  hour: "2-digit",
  minute: "2-digit",
});

type DayItem = { title: string; time: string | null; tint: string; done: boolean };

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const months = recentMonths(10);
  const nowMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : nowMonth;
  const [y, m] = month.split("-").map(Number);

  const start = `${month}-01`;
  const nextIso = new Date(Date.UTC(y, m, 1)).toISOString();
  const startIso = new Date(Date.UTC(y, m - 1, 1)).toISOString();

  const supabase = await createClient();
  const [{ data: tasks }, { data: reminders }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title,due_date,due_time,priority,status")
      .gte("due_date", start)
      .lt("due_date", `${month}-32`),
    supabase
      .from("reminders")
      .select("id,title,remind_at")
      .gte("remind_at", startIso)
      .lt("remind_at", nextIso),
  ]);

  // Bucket everything by day-of-month (1..31).
  const byDay = new Map<number, DayItem[]>();
  const push = (day: number, item: DayItem) => {
    const arr = byDay.get(day) ?? [];
    arr.push(item);
    byDay.set(day, arr);
  };

  const priTint: Record<string, string> = {
    critical: "bg-red-500/20 text-red-300",
    high: "bg-amber-500/20 text-amber-300",
    medium: "bg-brand-accent/20 text-brand-accent",
    low: "bg-sky-500/20 text-sky-300",
  };

  for (const t of tasks ?? []) {
    if (!t.due_date) continue;
    const day = Number(String(t.due_date).slice(8, 10));
    push(day, {
      title: t.title,
      time: t.due_time ? String(t.due_time).slice(0, 5) : null,
      tint: priTint[t.priority] ?? priTint.medium,
      done: t.status === "completed" || t.status === "cancelled",
    });
  }
  for (const r of reminders ?? []) {
    const d = new Date(r.remind_at);
    const day = Number(fmtDate.format(d).slice(8, 10));
    push(day, {
      title: r.title,
      time: fmtTime.format(d),
      tint: "bg-purple-500/20 text-purple-300",
      done: false,
    });
  }

  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay(); // 0=Sun
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayDay =
    month === nowMonth ? new Date().getDate() : -1;
  const totalItems = (tasks?.length ?? 0) + (reminders?.length ?? 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="text-xl text-brand-accent" />
          <h1 className="text-xl font-semibold">Calendar</h1>
        </div>
        <MonthPicker path="/calendar" months={months} current={month} />
      </div>

      <div className="card p-3 sm:p-5">
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-brand-muted">
          {DOW.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            const items = day ? byDay.get(day) ?? [] : [];
            const isToday = day === todayDay;
            return (
              <div
                key={i}
                className={`min-h-[76px] rounded-lg border p-1 text-left align-top sm:min-h-[96px] ${
                  day
                    ? isToday
                      ? "border-brand-accent bg-brand-accent/5"
                      : "border-brand-border bg-brand-fg/[0.02]"
                    : "border-transparent"
                }`}
              >
                {day && (
                  <div
                    className={`mb-1 text-right text-[11px] ${
                      isToday ? "font-bold text-brand-accent" : "text-brand-muted"
                    }`}
                  >
                    {day}
                  </div>
                )}
                <div className="space-y-1">
                  {items.slice(0, 3).map((it, j) => (
                    <div
                      key={j}
                      title={it.title}
                      className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight ${it.tint} ${
                        it.done ? "line-through opacity-60" : ""
                      }`}
                    >
                      {it.time ? `${it.time} ` : ""}
                      {it.title}
                    </div>
                  ))}
                  {items.length > 3 && (
                    <div className="px-1 text-[10px] text-brand-muted">
                      +{items.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-brand-muted">
        {totalItems === 0
          ? "Nothing scheduled this month. Tasks (with due dates) and reminders show up here."
          : `${totalItems} item${totalItems === 1 ? "" : "s"} this month · tasks by priority, reminders in purple.`}
      </p>
    </div>
  );
}
