"use client";

import { useState } from "react";
import { addTask, updateTask } from "@/app/actions";
import { PlusIcon } from "@/components/icons";

export type TaskInit = {
  id?: string;
  title?: string;
  description?: string | null;
  category?: string | null;
  priority?: string;
  status?: string;
  due_date?: string | null;
  due_time?: string | null;
  recurrence?: string | null;
  reminder_minutes?: number | null;
  notes?: string | null;
};

const input =
  "w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm outline-none focus:border-brand-accent";
const label = "text-xs text-brand-muted";

export default function TaskForm({
  task,
  onDone,
  compact,
}: {
  task?: TaskInit;
  onDone?: () => void;
  compact?: boolean;
}) {
  const editing = Boolean(task?.id);
  const [v, setV] = useState<TaskInit>({
    title: task?.title ?? "",
    description: task?.description ?? "",
    category: task?.category ?? "",
    priority: task?.priority ?? "medium",
    status: task?.status ?? "pending",
    due_date: task?.due_date ?? "",
    due_time: task?.due_time ? task.due_time.slice(0, 5) : "",
    recurrence: task?.recurrence ?? "",
    reminder_minutes:
      task?.reminder_minutes === null || task?.reminder_minutes === undefined
        ? null
        : task.reminder_minutes,
    notes: task?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function set<K extends keyof TaskInit>(k: K, val: TaskInit[K]) {
    setV((s) => ({ ...s, [k]: val }));
  }

  async function submit() {
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.set("title", v.title ?? "");
      fd.set("description", v.description ?? "");
      fd.set("category", v.category ?? "");
      fd.set("priority", v.priority ?? "medium");
      fd.set("status", v.status ?? "pending");
      fd.set("due_date", v.due_date ?? "");
      fd.set("due_time", v.due_time ?? "");
      fd.set("recurrence", v.recurrence ?? "");
      if (v.reminder_minutes !== null && v.reminder_minutes !== undefined)
        fd.set("reminder_minutes", String(v.reminder_minutes));
      fd.set("notes", v.notes ?? "");

      if (editing && task?.id) await updateTask(task.id, fd);
      else await addTask(fd);

      if (!editing) setV((s) => ({ ...s, title: "", description: "", notes: "" }));
      setMsg(editing ? "Saved ✓" : "Task added ✓");
      onDone?.();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Could not save.");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      <input
        value={v.title ?? ""}
        onChange={(e) => set("title", e.target.value)}
        placeholder="What needs doing?"
        className={input}
      />

      {!compact && (
        <input
          value={v.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Description (optional)"
          className={input}
        />
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className={label}>
          Priority
          <select value={v.priority} onChange={(e) => set("priority", e.target.value)} className={input}>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className={label}>
          Category
          <input value={v.category ?? ""} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Work" className={input} />
        </label>
        <label className={label}>
          Date
          <input value={v.due_date ?? ""} onChange={(e) => set("due_date", e.target.value)} type="date" className={input} />
        </label>
        <label className={label}>
          Time
          <input value={v.due_time ?? ""} onChange={(e) => set("due_time", e.target.value)} type="time" className={input} />
        </label>
        <label className={label}>
          Repeat
          <select value={v.recurrence ?? ""} onChange={(e) => set("recurrence", e.target.value)} className={input}>
            <option value="">No repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label className={label}>
          Remind
          <select
            value={v.reminder_minutes ?? ""}
            onChange={(e) => set("reminder_minutes", e.target.value === "" ? null : Number(e.target.value))}
            className={input}
          >
            <option value="">Default</option>
            <option value="0">At time</option>
            <option value="10">10 min before</option>
            <option value="30">30 min before</option>
            <option value="60">1 hour before</option>
          </select>
        </label>
        {editing && (
          <label className={label}>
            Status
            <select value={v.status} onChange={(e) => set("status", e.target.value)} className={input}>
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        )}
      </div>

      {!compact && (
        <textarea
          value={v.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className={`${input} resize-none`}
        />
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="btn-accent flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          <PlusIcon className="text-base" />
          {busy ? "…" : editing ? "Save" : "Add task"}
        </button>
        {msg && <span className="text-sm text-brand-muted">{msg}</span>}
      </div>
    </div>
  );
}
