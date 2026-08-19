"use client";

import { useState } from "react";
import { addSavingsGoal, logContribution } from "@/app/actions";
import { naira } from "@/components/Naira";
import { PiggyIcon } from "@/components/icons";

export type GoalRow = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
};

const input =
  "w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 outline-none focus:border-brand-accent";

function Goal({ goal }: { goal: GoalRow }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const pct =
    goal.target_amount > 0
      ? Math.round((goal.current_amount / goal.target_amount) * 100)
      : 0;
  const done = goal.current_amount >= goal.target_amount;
  const bar = done ? "bg-green-500" : "bg-brand-accent";

  async function contribute() {
    const value = Number(amount);
    if (!value || value <= 0) return;
    setBusy(true);
    setNote("");
    try {
      await logContribution(goal.id, value);
      setAmount("");
    } catch (e: unknown) {
      setNote(e instanceof Error ? e.message : "Could not save.");
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{goal.name}</span>
        <span className="text-brand-muted">
          {naira(goal.current_amount)} / {naira(goal.target_amount)}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-brand-bg">
        <div
          className={`h-full rounded-full ${bar}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-brand-muted">
        <span>{pct}% saved</span>
        {goal.deadline && <span>by {goal.deadline}</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          step="0.01"
          placeholder="Add contribution (₦)"
          className={input}
        />
        <button
          type="button"
          onClick={contribute}
          disabled={busy}
          className="rounded-lg border border-brand-border px-4 py-2 text-sm disabled:opacity-60"
        >
          {busy ? "…" : "Add"}
        </button>
      </div>
      {note && <p className="mt-1 text-xs text-brand-muted">{note}</p>}
    </div>
  );
}

export default function SavingsGoals({ goals }: { goals: GoalRow[] }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setNote("");
    try {
      const fd = new FormData();
      fd.set("name", name);
      fd.set("target_amount", target);
      fd.set("deadline", deadline);
      await addSavingsGoal(fd);
      setName("");
      setTarget("");
      setDeadline("");
      setNote("Saved ✓");
    } catch (e: unknown) {
      setNote(e instanceof Error ? e.message : "Could not save.");
    }
    setBusy(false);
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-muted">
        <PiggyIcon className="text-base text-brand-accent" />
        Savings goals
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Goal (e.g. Laptop)"
          className={input}
        />
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          type="number"
          step="0.01"
          placeholder="Target (₦)"
          className={input}
        />
        <input
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          type="date"
          className={input}
        />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-brand-accent px-4 py-2 font-semibold text-white disabled:opacity-60 sm:px-6"
        >
          {busy ? "…" : "Add"}
        </button>
      </div>

      {note && <p className="mt-3 text-sm text-brand-muted">{note}</p>}

      {goals.length === 0 ? (
        <p className="mt-4 text-sm text-brand-muted">
          No goals yet. Add one above and log contributions as you save.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {goals.map((g) => (
            <Goal key={g.id} goal={g} />
          ))}
        </div>
      )}
    </div>
  );
}
