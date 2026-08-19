"use client";

import { useState } from "react";
import { addIncome, updateIncome } from "@/app/actions";
import { IncomeIcon } from "@/components/icons";

export const INCOME_TYPES = [
  "Salary",
  "Teaching",
  "Freelancing",
  "Business",
  "Investments",
  "Other",
];

export type IncomeInit = {
  id?: string;
  amount?: number;
  source_name?: string | null;
  category?: string | null;
  account?: string | null;
  description?: string | null;
  notes?: string | null;
  occurred_on?: string | null;
};

const input =
  "w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm outline-none focus:border-brand-accent";
const label = "text-xs text-brand-muted";

export default function IncomeForm({
  income,
  onDone,
}: {
  income?: IncomeInit;
  onDone?: () => void;
}) {
  const editing = Boolean(income?.id);
  const [amount, setAmount] = useState(income?.amount ? String(income.amount) : "");
  const [category, setCategory] = useState(income?.category ?? "Salary");
  const [source, setSource] = useState(income?.source_name ?? "");
  const [account, setAccount] = useState(income?.account ?? "");
  const [date, setDate] = useState(income?.occurred_on ?? new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(income?.description ?? "");
  const [notes, setNotes] = useState(income?.notes ?? "");
  const [recurrence, setRecurrence] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit() {
    setBusy(true);
    setMsg("");
    try {
      if (editing && income?.id) {
        await updateIncome(income.id, {
          amount: Number(amount),
          source_name: source || category,
          description: description || null,
          occurred_on: date,
          category: category || null,
          account: account || null,
          notes: notes || null,
        });
      } else {
        const fd = new FormData();
        fd.set("amount", amount);
        fd.set("category", category);
        fd.set("source_name", source || category);
        fd.set("account", account);
        fd.set("occurred_on", date);
        fd.set("description", description);
        fd.set("notes", notes);
        fd.set("recurrence", recurrence);
        await addIncome(fd);
        setAmount("");
        setSource("");
        setDescription("");
        setNotes("");
        setRecurrence("");
      }
      setMsg(editing ? "Saved ✓" : "Income added ✓");
      onDone?.();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Could not save.");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className={label}>
          Amount (₦)
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" className={input} />
        </label>
        <label className={label}>
          Type
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
            {INCOME_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Date
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className={input} />
        </label>
        <label className={label}>
          From (source)
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. D-Maths Academy" className={input} />
        </label>
        <label className={label}>
          Account
          <input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="e.g. Bank / Cash" className={input} />
        </label>
        {!editing && (
          <label className={label}>
            Recurring
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className={input}>
              <option value="">One-off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        )}
      </div>
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className={input} />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className={`${input} resize-none`} />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="btn-accent flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          <IncomeIcon className="text-base" />
          {busy ? "…" : editing ? "Save" : "Add income"}
        </button>
        {msg && <span className="text-sm text-brand-muted">{msg}</span>}
      </div>
    </div>
  );
}
