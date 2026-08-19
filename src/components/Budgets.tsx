"use client";

import { useState } from "react";
import { upsertBudget, deleteBudget } from "@/app/actions";
import { naira } from "@/components/Naira";
import { WalletIcon, TrashIcon } from "@/components/icons";

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

export type BudgetRow = {
  id: string;
  category: string;
  monthly_limit: number;
  spent: number;
};

export default function Budgets({ budgets }: { budgets: BudgetRow[] }) {
  const [category, setCategory] = useState("Food");
  const [limit, setLimit] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setNote("");
    try {
      const fd = new FormData();
      fd.set("category", category);
      fd.set("monthly_limit", limit);
      await upsertBudget(fd);
      setLimit("");
      setNote("Saved ✓");
    } catch (e: unknown) {
      setNote(e instanceof Error ? e.message : "Could not save.");
    }
    setBusy(false);
  }

  const input =
    "w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 outline-none focus:border-brand-accent";

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-muted">
        <WalletIcon className="text-base text-brand-accent" />
        Monthly budgets
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={input}
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          type="number"
          step="0.01"
          placeholder="Monthly limit (₦)"
          className={input}
        />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-brand-accent px-4 py-2 font-semibold text-white disabled:opacity-60 sm:px-6"
        >
          {busy ? "…" : "Set"}
        </button>
      </div>

      {note && <p className="mt-3 text-sm text-brand-muted">{note}</p>}

      {budgets.length === 0 ? (
        <p className="mt-4 text-sm text-brand-muted">
          No budgets yet. Set a monthly limit for a category above.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {budgets.map((b) => {
            const remaining = b.monthly_limit - b.spent;
            const pct =
              b.monthly_limit > 0
                ? Math.round((b.spent / b.monthly_limit) * 100)
                : 0;
            const over = remaining < 0;
            const bar =
              pct >= 100
                ? "bg-red-500"
                : pct >= 80
                  ? "bg-orange-500"
                  : "bg-brand-accent";
            return (
              <div key={b.id}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{b.category}</span>
                  <span className="flex items-center gap-2 text-brand-muted">
                    {naira(b.spent)} / {naira(b.monthly_limit)}
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`Delete the ${b.category} budget?`))
                          await deleteBudget(b.id);
                      }}
                      title="Delete budget"
                      className="opacity-60 transition hover:text-red-400 hover:opacity-100"
                    >
                      <TrashIcon className="text-sm" />
                    </button>
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-brand-bg">
                  <div
                    className={`h-full rounded-full ${bar}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-xs text-brand-muted">
                  <span>{pct}% used</span>
                  <span className={over ? "text-red-400" : "text-green-400"}>
                    {over
                      ? `${naira(-remaining)} over`
                      : `${naira(remaining)} left`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
