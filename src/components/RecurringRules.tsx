"use client";

import { useState } from "react";
import { addRecurringRule, deleteRecurringRule } from "@/app/actions";
import { naira } from "@/components/Naira";
import { RepeatIcon, TrashIcon } from "@/components/icons";

export type RuleRow = {
  id: string;
  kind: "expense" | "income";
  amount: number;
  category: string;
  frequency: string;
  next_run: string;
};

const input =
  "w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm outline-none focus:border-brand-accent";

export default function RecurringRules({ rules }: { rules: RuleRow[] }) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [nextRun, setNextRun] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("amount", amount);
      fd.set("category", category);
      fd.set("frequency", frequency);
      fd.set("next_run", nextRun);
      await addRecurringRule(fd);
      setAmount("");
      setCategory("");
      setNextRun("");
      setMsg("Recurring rule added ✓");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Could not save.");
    }
    setBusy(false);
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-muted">
        <RepeatIcon className="text-base text-brand-accent" />
        Recurring (rent, salary, subscriptions)
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <select value={kind} onChange={(e) => setKind(e.target.value as "expense" | "income")} className={input}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" placeholder="Amount (₦)" className={input} />
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={kind === "income" ? "Source" : "Category"} className={input} />
        <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className={input}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <label className="text-xs text-brand-muted">
          Starts
          <input value={nextRun} onChange={(e) => setNextRun(e.target.value)} type="date" className={input} />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="btn-accent self-end rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "…" : "Add rule"}
        </button>
      </div>

      {msg && <p className="mt-3 text-sm text-brand-muted">{msg}</p>}

      {rules.length > 0 && (
        <div className="mt-4 divide-y divide-white/5">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center gap-2 py-2 text-sm">
              <span
                className={`h-2 w-2 rounded-full ${r.kind === "income" ? "bg-green-400" : "bg-brand-accent"}`}
              />
              <span className="font-medium">{r.category}</span>
              <span className="text-brand-muted">· {r.frequency}</span>
              <span className="ml-auto text-brand-muted">
                {naira(r.amount)} · next {r.next_run}
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (confirm(`Delete this recurring ${r.kind}?`))
                    await deleteRecurringRule(r.id);
                }}
                title="Delete rule"
                className="opacity-60 transition hover:text-red-400 hover:opacity-100"
              >
                <TrashIcon className="text-sm" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
