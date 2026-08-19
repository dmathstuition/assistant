"use client";

import { useEffect, useRef, useState } from "react";
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

const AMOUNT_CHIPS = [500, 1000, 2000, 5000];

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
      className={`flex-1 rounded-md py-2 text-sm ${active ? "btn-accent text-white" : "text-brand-muted"}`}
    >
      {children}
    </button>
  );
}

// `categories`/`sources` are the user's own past values, offered as autocomplete.
export default function QuickAdd({
  categories = [],
  sources = [],
}: {
  categories?: string[];
  sources?: string[];
}) {
  const [tab, setTab] = useState<"expense" | "income" | "task">("expense");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [source, setSource] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // Remember the last-used category and income source.
  useEffect(() => {
    const c = localStorage.getItem("qa_last_cat");
    if (c) setCategory(c);
    const s = localStorage.getItem("qa_last_source");
    if (s) setSource(s);
  }, []);

  const catOptions = Array.from(new Set([...categories, ...EXPENSE_CATEGORIES]));

  async function run(
    fn: (fd: FormData) => Promise<void>,
    after?: () => void,
  ) {
    if (!formRef.current) return;
    setNote("");
    try {
      await fn(new FormData(formRef.current));
      setAmount("");
      setNote("Saved ✓");
      after?.();
    } catch (e: unknown) {
      setNote(e instanceof Error ? e.message : "Could not save.");
    }
  }

  const input =
    "w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 outline-none focus:border-brand-accent";

  const chips = (
    <div className="flex flex-wrap gap-2">
      {AMOUNT_CHIPS.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => setAmount(String(v))}
          className="btn-ghost rounded-full px-3 py-1 text-xs"
        >
          ₦{v.toLocaleString()}
        </button>
      ))}
    </div>
  );

  return (
    <div className="card p-5">
      <div className="mb-4 flex rounded-lg bg-brand-bg p-1">
        <Tab active={tab === "expense"} onClick={() => setTab("expense")}>Expense</Tab>
        <Tab active={tab === "income"} onClick={() => setTab("income")}>Income</Tab>
        <Tab active={tab === "task"} onClick={() => setTab("task")}>Task</Tab>
      </div>

      <datalist id="qa-cats">
        {catOptions.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="qa-sources">
        {sources.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <form ref={formRef} className="space-y-3">
        {tab === "expense" && (
          <>
            <input
              name="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              step="0.01"
              placeholder="Amount (₦)"
              className={input}
            />
            {chips}
            <input
              name="category"
              list="qa-cats"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category"
              className={input}
            />
            <input name="description" placeholder="Description (optional)" className={input} />
            <button
              type="button"
              onClick={() =>
                run(addExpense, () => localStorage.setItem("qa_last_cat", category))
              }
              className="btn-accent w-full rounded-lg py-2.5 font-semibold text-white"
            >
              Add expense
            </button>
          </>
        )}

        {tab === "income" && (
          <>
            <input
              name="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              step="0.01"
              placeholder="Amount (₦)"
              className={input}
            />
            {chips}
            <input
              name="source_name"
              list="qa-sources"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Source (e.g. Teaching)"
              className={input}
            />
            <input name="description" placeholder="Description (optional)" className={input} />
            <button
              type="button"
              onClick={() =>
                run(addIncome, () => localStorage.setItem("qa_last_source", source))
              }
              className="btn-accent w-full rounded-lg py-2.5 font-semibold text-white"
            >
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
            <button
              type="button"
              onClick={() => run(addTask, () => formRef.current?.reset())}
              className="btn-accent w-full rounded-lg py-2.5 font-semibold text-white"
            >
              Add task
            </button>
          </>
        )}
      </form>

      {note && <p className="mt-3 text-sm text-brand-muted">{note}</p>}
    </div>
  );
}
