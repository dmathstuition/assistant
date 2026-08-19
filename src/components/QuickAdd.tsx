"use client";

import { useRef, useState } from "react";
import { addExpense, addIncome, addTask } from "@/app/actions";

const EXPENSE_CATEGORIES = [
  "Food",
  "Transportation",
  "Rent",
  "Utilities",
  "Education",
  "Business",
  "Entertainment",
  "Shopping",
  "Healthcare",
  "Subscriptions",
  "Family",
  "Other",
];

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md py-2 text-sm ${active ? "bg-brand-accent text-white" : "text-brand-muted"}`}
    >
      {children}
    </button>
  );
}

export default function QuickAdd() {
  const [tab, setTab] = useState<"expense" | "income" | "task">("expense");
  const [note, setNote] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function run(fn: (fd: FormData) => Promise<void>) {
    if (!formRef.current) return;
    setNote("");
    try {
      await fn(new FormData(formRef.current));
      formRef.current.reset();
      setNote("Saved \u2713");
    } catch (e: unknown) {
      setNote(e instanceof Error ? e.message : "Could not save.");
    }
  }

  const input =
    "w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 outline-none focus:border-brand-accent";

  return (
    <div className="card p-5">
      <div className="mb-4 flex rounded-lg bg-brand-bg p-1">
        <Tab active={tab === "expense"} onClick={() => setTab("expense")}>
          Expense
        </Tab>
        <Tab active={tab === "income"} onClick={() => setTab("income")}>
          Income
        </Tab>
        <Tab active={tab === "task"} onClick={() => setTab("task")}>
          Task
        </Tab>
      </div>

      <form ref={formRef} className="space-y-3">
        {tab === "expense" && (
          <>
            <input name="amount" type="number" step="0.01" placeholder="Amount (₦)" className={input} />
            <select name="category" className={input} defaultValue="Food">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input name="description" placeholder="Description (optional)" className={input} />
            <button type="button" onClick={() => run(addExpense)} className="w-full rounded-lg bg-brand-accent py-2.5 font-semibold text-white">
              Add expense
            </button>
          </>
        )}

        {tab === "income" && (
          <>
            <input name="amount" type="number" step="0.01" placeholder="Amount (₦)" className={input} />
            <input name="source_name" placeholder="Source (e.g. Teaching)" className={input} />
            <input name="description" placeholder="Description (optional)" className={input} />
            <button type="button" onClick={() => run(addIncome)} className="w-full rounded-lg bg-brand-accent py-2.5 font-semibold text-white">
              Add income
            </button>
          </>
        )}

        {tab === "task" && (
          <>
            <input name="title" placeholder="Task title" className={input} />
            <select name="priority" className={input} defaultValue="medium">
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <div className="flex gap-3">
              <label className="flex-1 text-xs text-brand-muted">
                Date
                <input name="due_date" type="date" className={input} />
              </label>
              <label className="flex-1 text-xs text-brand-muted">
                Time
                <input name="due_time" type="time" className={input} />
              </label>
            </div>
            <button type="button" onClick={() => run(addTask)} className="w-full rounded-lg bg-brand-accent py-2.5 font-semibold text-white">
              Add task
            </button>
          </>
        )}
      </form>

      {note && <p className="mt-3 text-sm text-brand-muted">{note}</p>}
    </div>
  );
}
