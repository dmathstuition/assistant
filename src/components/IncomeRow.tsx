"use client";

import { useState } from "react";
import { deleteIncome } from "@/app/actions";
import IncomeForm, { type IncomeInit } from "@/components/IncomeForm";
import { useToast } from "@/components/ToastProvider";
import { naira } from "@/components/Naira";
import { IncomeIcon, PencilIcon, TrashIcon } from "@/components/icons";

export type IncomeEntry = {
  id: string;
  amount: number;
  source_name: string | null;
  category: string | null;
  account: string | null;
  description: string | null;
  notes: string | null;
  occurred_on: string;
};

export default function IncomeRow({ entry }: { entry: IncomeEntry }) {
  const [editing, setEditing] = useState(false);
  const [gone, setGone] = useState(false);
  const { undo } = useToast();

  if (gone) return null;

  function remove() {
    setGone(true);
    undo(
      "Income deleted",
      () => deleteIncome(entry.id),
      () => setGone(false),
    );
  }

  if (editing) {
    return (
      <div className="py-3">
        <IncomeForm income={entry as IncomeInit} onDone={() => setEditing(false)} />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="btn-ghost mt-2 rounded-lg px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
    );
  }

  const sub = [entry.category, entry.account, entry.description]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-center gap-3 py-3">
      <span className="text-base text-green-400">
        <IncomeIcon />
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">
          {entry.source_name || entry.category || "Income"}
        </div>
        <div className="truncate text-xs text-brand-muted">
          {entry.occurred_on}
          {sub ? ` · ${sub}` : ""}
        </div>
      </div>
      <div className="ml-auto whitespace-nowrap text-sm font-semibold text-green-400">
        +{naira(entry.amount)}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setEditing(true)} title="Edit" className="p-1 text-brand-muted hover:text-brand-fg">
          <PencilIcon className="text-sm" />
        </button>
        <button onClick={remove} title="Delete" className="p-1 text-brand-muted hover:text-red-400">
          <TrashIcon className="text-sm" />
        </button>
      </div>
    </div>
  );
}
