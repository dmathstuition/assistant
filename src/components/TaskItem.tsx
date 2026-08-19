"use client";

import { useState } from "react";
import { toggleTask } from "@/app/actions";

export default function TaskItem({
  id,
  title,
  status,
  due_date,
  priority,
}: {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  priority: string;
}) {
  const [done, setDone] = useState(status === "completed");
  const [busy, setBusy] = useState(false);

  async function flip() {
    setBusy(true);
    const next = !done;
    setDone(next);
    try {
      await toggleTask(id, next);
    } catch {
      setDone(!next);
    }
    setBusy(false);
  }

  const dot =
    priority === "critical"
      ? "bg-red-500"
      : priority === "high"
        ? "bg-orange-500"
        : priority === "low"
          ? "bg-slate-500"
          : "bg-yellow-500";

  return (
    <label className="flex items-center gap-3 py-2">
      <input type="checkbox" checked={done} onChange={flip} disabled={busy} />
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className={done ? "text-brand-muted line-through" : ""}>{title}</span>
      {due_date && (
        <span className="ml-auto text-xs text-brand-muted">{due_date}</span>
      )}
    </label>
  );
}
