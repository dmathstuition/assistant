"use client";

import { useState } from "react";
import {
  updateExpense,
  updateIncome,
  deleteExpense,
  deleteIncome,
} from "@/app/actions";
import { naira } from "@/components/Naira";
import { PencilIcon, TrashIcon, WalletIcon, IncomeIcon } from "@/components/icons";

export type Txn = {
  id: string;
  kind: "expense" | "income";
  date: string; // occurred_on (yyyy-mm-dd)
  label: string; // category (expense) or source_name (income)
  amount: number;
  description: string | null;
};

const input =
  "w-full rounded-lg border border-brand-border bg-brand-bg px-2.5 py-1.5 text-sm outline-none focus:border-brand-accent";

export default function TransactionRow({ txn }: { txn: Txn }) {
  const [editing, setEditing] = useState(false);
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(String(txn.amount));
  const [label, setLabel] = useState(txn.label);
  const [date, setDate] = useState(txn.date);
  const [description, setDescription] = useState(txn.description ?? "");

  if (gone) return null;

  const isExpense = txn.kind === "expense";
  const tint = isExpense ? "text-brand-accent" : "text-green-400";

  async function save() {
    setBusy(true);
    try {
      const amt = Number(amount);
      if (isExpense) {
        await updateExpense(txn.id, {
          amount: amt,
          category: label,
          description: description || null,
          occurred_on: date,
        });
      } else {
        await updateIncome(txn.id, {
          amount: amt,
          source_name: label,
          description: description || null,
          occurred_on: date,
        });
      }
      setEditing(false);
    } catch {
      /* keep editing on error */
    }
    setBusy(false);
  }

  async function remove() {
    if (!confirm("Delete this transaction?")) return;
    setBusy(true);
    setGone(true);
    try {
      await (isExpense ? deleteExpense(txn.id) : deleteIncome(txn.id));
    } catch {
      setGone(false);
    }
    setBusy(false);
  }

  if (editing) {
    return (
      <div className="grid grid-cols-2 gap-2 py-3 sm:grid-cols-5">
        <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className={input} />
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Category" className={input} />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" className={input} />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Note" className={input} />
        <div className="flex gap-2">
          <button onClick={save} disabled={busy} className="btn-accent flex-1 rounded-lg py-1.5 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? "…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="btn-ghost rounded-lg px-3 py-1.5 text-sm">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 py-3">
      <span className={`text-base ${tint}`}>
        {isExpense ? <WalletIcon /> : <IncomeIcon />}
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{txn.label}</div>
        <div className="truncate text-xs text-brand-muted">
          {txn.date}
          {txn.description ? ` · ${txn.description}` : ""}
        </div>
      </div>
      <div className={`ml-auto whitespace-nowrap text-sm font-semibold ${tint}`}>
        {isExpense ? "−" : "+"}
        {naira(txn.amount)}
      </div>
      <div className="flex items-center gap-1 opacity-60 transition group-hover:opacity-100">
        <button onClick={() => setEditing(true)} title="Edit" className="p-1 hover:text-white">
          <PencilIcon className="text-sm" />
        </button>
        <button onClick={remove} disabled={busy} title="Delete" className="p-1 hover:text-red-400">
          <TrashIcon className="text-sm" />
        </button>
      </div>
    </div>
  );
}
