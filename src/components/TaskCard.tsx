"use client";

import { useState } from "react";
import { setTaskStatus, deleteTask } from "@/app/actions";
import TaskForm, { type TaskInit } from "@/components/TaskForm";
import { PencilIcon, TrashIcon, RepeatIcon, ClockIcon } from "@/components/icons";

export type FullTask = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  due_time: string | null;
  recurrence: string | null;
  reminder_minutes: number | null;
  notes: string | null;
};

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-slate-500",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-white/5 text-brand-muted",
  in_progress: "bg-sky-500/15 text-sky-300",
  completed: "bg-green-500/15 text-green-300",
  overdue: "bg-red-500/15 text-red-300",
  cancelled: "bg-white/5 text-brand-muted line-through",
};

function effectiveStatus(t: FullTask) {
  if (
    (t.status === "pending" || t.status === "in_progress") &&
    t.due_date &&
    t.due_date < new Date().toISOString().slice(0, 10)
  )
    return "overdue";
  return t.status;
}

export default function TaskCard({ task }: { task: FullTask }) {
  const [editing, setEditing] = useState(false);
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (gone) return null;

  const eff = effectiveStatus(task);
  const done = task.status === "completed";

  async function toggleDone() {
    setBusy(true);
    try {
      await setTaskStatus(task.id, done ? "pending" : "completed");
    } catch {
      /* ignore */
    }
    setBusy(false);
  }

  async function changeStatus(status: string) {
    setBusy(true);
    try {
      await setTaskStatus(task.id, status);
    } catch {
      /* ignore */
    }
    setBusy(false);
  }

  async function remove() {
    if (!confirm("Delete this task?")) return;
    setBusy(true);
    setGone(true);
    try {
      await deleteTask(task.id);
    } catch {
      setGone(false);
    }
    setBusy(false);
  }

  if (editing) {
    return (
      <div className="py-3">
        <TaskForm task={task as TaskInit} onDone={() => setEditing(false)} />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="btn-ghost mt-2 rounded-lg px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
    );
  }

  const when = [task.due_date, task.due_time ? task.due_time.slice(0, 5) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-start gap-3 py-3">
      <input
        type="checkbox"
        checked={done}
        onChange={toggleDone}
        disabled={busy}
        className="mt-1"
      />
      <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority] ?? "bg-yellow-500"}`} />

      <div className="min-w-0 flex-1">
        <div className={`text-sm ${done ? "text-brand-muted line-through" : "font-medium"}`}>
          {task.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-brand-muted">
          <span className={`rounded-full px-2 py-0.5 ${STATUS_STYLE[eff] ?? STATUS_STYLE.pending}`}>
            {eff.replace("_", " ")}
          </span>
          {task.category && (
            <span className="rounded-full border border-white/10 px-2 py-0.5">{task.category}</span>
          )}
          {when && (
            <span className="flex items-center gap-1">
              <ClockIcon className="text-xs" />
              {when}
            </span>
          )}
          {task.recurrence && (
            <span className="flex items-center gap-1 text-brand-accent">
              <RepeatIcon className="text-xs" />
              {task.recurrence}
            </span>
          )}
        </div>
        {task.notes && <p className="mt-1 text-xs text-brand-muted">{task.notes}</p>}
      </div>

      <div className="flex items-center gap-1">
        <select
          value={task.status}
          onChange={(e) => changeStatus(e.target.value)}
          disabled={busy}
          className="rounded-lg border border-brand-border bg-brand-bg px-2 py-1 text-xs text-brand-muted outline-none"
          title="Status"
        >
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button onClick={() => setEditing(true)} title="Edit" className="p-1 text-brand-muted hover:text-white">
          <PencilIcon className="text-sm" />
        </button>
        <button onClick={remove} disabled={busy} title="Delete" className="p-1 text-brand-muted hover:text-red-400">
          <TrashIcon className="text-sm" />
        </button>
      </div>
    </div>
  );
}
