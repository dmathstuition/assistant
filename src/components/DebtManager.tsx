"use client";

import { useState } from "react";
import { addDebt, logDebtPayment, markDebtPaid, deleteDebt } from "@/app/actions";
import { naira } from "@/components/Naira";
import { DebtIcon, TrashIcon } from "@/components/icons";

export type DebtRow = {
  id: string;
  creditor: string;
  amount: number;
  amount_paid: number;
  month: string;
  due_on: string | null;
  notes: string | null;
};

const input =
  "w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 outline-none focus:border-brand-accent";

function Debt({ debt }: { debt: DebtRow }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const outstanding = Math.max(debt.amount - debt.amount_paid, 0);
  const pct = debt.amount > 0 ? Math.round((debt.amount_paid / debt.amount) * 100) : 0;
  const done = debt.amount_paid >= debt.amount;

  async function pay() {
    const value = Number(amount);
    if (!value || value <= 0) return;
    setBusy(true);
    setNote("");
    try {
      await logDebtPayment(debt.id, value);
      setAmount("");
    } catch (e: unknown) {
      setNote(e instanceof Error ? e.message : "Could not save.");
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">
          {debt.creditor}
          {done && <span className="ml-2 text-xs text-green-400">paid ✓</span>}
        </span>
        <span className="flex items-center gap-2 text-brand-muted">
          {naira(debt.amount_paid)} / {naira(debt.amount)}
          <button
            type="button"
            onClick={async () => {
              if (confirm(`Delete the debt to "${debt.creditor}"?`))
                await deleteDebt(debt.id);
            }}
            title="Delete debt"
            className="opacity-60 transition hover:text-red-400 hover:opacity-100"
          >
            <TrashIcon className="text-sm" />
          </button>
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-brand-bg">
        <div
          className={`h-full rounded-full ${done ? "bg-green-500" : "bg-brand-accent"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-brand-muted">
        <span>
          {pct}% paid{!done && ` · ${naira(outstanding)} left`}
        </span>
        {debt.due_on && <span>due {debt.due_on}</span>}
      </div>
      {debt.notes && <p className="mt-1 text-xs text-brand-muted">{debt.notes}</p>}
      {!done && (
        <div className="mt-2 flex gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            step="0.01"
            placeholder="Record a payment (₦)"
            className={input}
          />
          <button
            type="button"
            onClick={pay}
            disabled={busy}
            className="rounded-lg border border-brand-border px-4 py-2 text-sm disabled:opacity-60"
          >
            {busy ? "…" : "Pay"}
          </button>
          <button
            type="button"
            onClick={() => markDebtPaid(debt.id)}
            title="Mark fully paid"
            className="rounded-lg border border-brand-border px-3 py-2 text-sm text-brand-muted hover:text-brand-fg"
          >
            Paid
          </button>
        </div>
      )}
      {note && <p className="mt-1 text-xs text-brand-muted">{note}</p>}
    </div>
  );
}

export default function DebtManager({
  debts,
  month,
}: {
  debts: DebtRow[];
  month: string;
}) {
  const [creditor, setCreditor] = useState("");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState("");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!creditor.trim() || !Number(amount)) {
      setNote("Enter who you owe and how much.");
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const fd = new FormData();
      fd.set("creditor", creditor);
      fd.set("amount", amount);
      fd.set("amount_paid", paid || "0");
      fd.set("month", month);
      fd.set("due_on", due);
      await addDebt(fd);
      setCreditor("");
      setAmount("");
      setPaid("");
      setDue("");
      setNote("Saved ✓");
    } catch (e: unknown) {
      setNote(e instanceof Error ? e.message : "Could not save.");
    }
    setBusy(false);
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-muted">
        <DebtIcon className="text-base text-brand-accent" />
        Debts for {month}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={creditor}
          onChange={(e) => setCreditor(e.target.value)}
          placeholder="Who you owe (e.g. Bank loan)"
          className={input}
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          step="0.01"
          placeholder="Amount owed (₦)"
          className={input}
        />
        <input
          value={paid}
          onChange={(e) => setPaid(e.target.value)}
          type="number"
          step="0.01"
          placeholder="Already paid (₦, optional)"
          className={input}
        />
        <input
          value={due}
          onChange={(e) => setDue(e.target.value)}
          type="date"
          className={input}
        />
      </div>
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="mt-3 rounded-lg bg-brand-accent px-6 py-2 font-semibold text-white disabled:opacity-60"
      >
        {busy ? "…" : "Add debt"}
      </button>

      {note && <p className="mt-3 text-sm text-brand-muted">{note}</p>}

      {debts.length === 0 ? (
        <p className="mt-4 text-sm text-brand-muted">
          No debts logged for {month}. Add one above and record payments as you clear it.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {debts.map((d) => (
            <Debt key={d.id} debt={d} />
          ))}
        </div>
      )}
    </div>
  );
}
