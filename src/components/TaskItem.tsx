"use client";

import { useState } from "react";
import { toggleTask, deleteTask } from "@/app/actions";
import { TrashIcon } from "@/components/icons";

export default function TaskItem({
  id,
  title,
  status,
  due_date,
  due_time,
  priority,
}: {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  due_time?: string | null;
  priority: string;
}) {
  const [done, setDone] = useState(status === "completed");
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState(false);

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

  async function remove() {
    if (!confirm("Delete this task?")) return;
    setBusy(true);
    setRemoved(true);
    try {
      await deleteTask(id);
    } catch {
      setRemoved(false);
    }
    setBusy(false);
  }

  if (removed) return null;

  const dot =
    priority === "critical"
      ? "bg-red-500"
      : priority === "high"
        ? "bg-orange-500"
        : priority === "low"
          ? "bg-slate-500"
          : "bg-yellow-500";

  return (
    <div className="group flex items-center gap-3 py-2">
      <input type="checkbox" checked={done} onChange={flip} disabled={busy} />
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className={done ? "text-brand-muted line-through" : ""}>{title}</span>
      <span className="ml-auto flex items-center gap-2">
        {(due_date || due_time) && (
          <span className="text-xs text-brand-muted">
            {[due_date, due_time ? due_time.slice(0, 5) : null]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          title="Delete task"
          className="text-brand-muted opacity-60 transition hover:text-red-400 hover:opacity-100"
        >
          <TrashIcon className="text-sm" />
        </button>
      </span>
    </div>
  );
}
