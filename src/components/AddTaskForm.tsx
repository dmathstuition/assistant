"use client";

import { useRef, useState } from "react";
import { addTask } from "@/app/actions";
import { PlusIcon } from "@/components/icons";

// Compact task creator used on the planner page: title, priority, date, time.
export default function AddTaskForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const input =
    "w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm outline-none focus:border-brand-accent";

  async function submit() {
    if (!formRef.current) return;
    setBusy(true);
    setMsg("");
    try {
      await addTask(new FormData(formRef.current));
      formRef.current.reset();
      setMsg("Task added ✓");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Could not add task.");
    }
    setBusy(false);
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-muted">
        <PlusIcon className="text-base text-brand-accent" />
        Add a task
      </div>
      <form ref={formRef} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input
          name="title"
          placeholder="What needs doing?"
          className={`${input} col-span-2 sm:col-span-4`}
        />
        <select name="priority" defaultValue="medium" className={input}>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <input name="due_date" type="date" className={input} />
        <input name="due_time" type="time" className={input} />
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="btn-accent rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "…" : "Add"}
        </button>
      </form>
      {msg && <p className="mt-3 text-sm text-brand-muted">{msg}</p>}
    </div>
  );
}
