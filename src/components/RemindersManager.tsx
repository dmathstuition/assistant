"use client";

import { useState } from "react";
import {
  addReminder,
  deleteReminder,
  addAlertRule,
  deleteAlertRule,
} from "@/app/actions";
import { naira } from "@/components/Naira";
import { BellIcon, RepeatIcon, TrashIcon, WalletIcon } from "@/components/icons";

export type ReminderItem = {
  id: string;
  title: string;
  remind_at: string;
  recurring: string | null;
};
export type RuleItem = {
  id: string;
  type: string;
  category: string | null;
  window: string | null;
  threshold: number;
};

const input =
  "w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm outline-none focus:border-brand-accent";
const labelC = "text-xs text-brand-muted";

function ruleText(r: RuleItem) {
  if (r.type === "balance_below")
    return `Notify when balance falls below ${naira(r.threshold)}`;
  const cat = r.category ? ` on ${r.category}` : "";
  return `Notify when spend${cat} this ${r.window ?? "week"} exceeds ${naira(r.threshold)}`;
}

export default function RemindersManager({
  reminders,
  rules,
}: {
  reminders: ReminderItem[];
  rules: RuleItem[];
}) {
  // Reminder form
  const [title, setTitle] = useState("");
  const [at, setAt] = useState("");
  const [recurring, setRecurring] = useState("");
  const [rMsg, setRMsg] = useState("");
  const [rBusy, setRBusy] = useState(false);

  // Rule form
  const [type, setType] = useState("spend_threshold");
  const [category, setCategory] = useState("");
  const [window, setWindow] = useState("week");
  const [threshold, setThreshold] = useState("");
  const [aMsg, setAMsg] = useState("");
  const [aBusy, setABusy] = useState(false);

  async function saveReminder() {
    setRBusy(true);
    setRMsg("");
    try {
      const fd = new FormData();
      fd.set("title", title);
      fd.set("remind_at", at);
      fd.set("recurring", recurring);
      await addReminder(fd);
      setTitle("");
      setAt("");
      setRecurring("");
      setRMsg("Reminder set ✓");
    } catch (e: unknown) {
      setRMsg(e instanceof Error ? e.message : "Could not save.");
    }
    setRBusy(false);
  }

  async function saveRule() {
    setABusy(true);
    setAMsg("");
    try {
      const fd = new FormData();
      fd.set("type", type);
      fd.set("threshold", threshold);
      if (type === "spend_threshold") {
        fd.set("category", category);
        fd.set("window", window);
      }
      await addAlertRule(fd);
      setThreshold("");
      setCategory("");
      setAMsg("Rule added ✓");
    } catch (e: unknown) {
      setAMsg(e instanceof Error ? e.message : "Could not save.");
    }
    setABusy(false);
  }

  return (
    <div className="space-y-5">
      {/* Reminders */}
      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-muted">
          <BellIcon className="text-base text-brand-accent" />
          Reminders
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Remind me to…"
            className={`${input} sm:col-span-2`}
          />
          <input value={at} onChange={(e) => setAt(e.target.value)} type="datetime-local" className={input} />
          <select value={recurring} onChange={(e) => setRecurring(e.target.value)} className={input}>
            <option value="">One-time</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button onClick={saveReminder} disabled={rBusy} className="btn-accent rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {rBusy ? "…" : "Set reminder"}
          </button>
          {rMsg && <span className="text-sm text-brand-muted">{rMsg}</span>}
        </div>

        {reminders.length > 0 && (
          <div className="mt-4 divide-y divide-white/5">
            {reminders.map((r) => (
              <div key={r.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="truncate">{r.title}</span>
                {r.recurring && (
                  <span className="flex items-center gap-1 text-xs text-brand-accent">
                    <RepeatIcon className="text-xs" />
                    {r.recurring}
                  </span>
                )}
                <span className="ml-auto whitespace-nowrap text-xs text-brand-muted">
                  {new Date(r.remind_at).toLocaleString("en-NG", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <button
                  onClick={async () => {
                    if (confirm("Delete this reminder?")) await deleteReminder(r.id);
                  }}
                  className="p-1 text-brand-muted hover:text-red-400"
                  title="Delete"
                >
                  <TrashIcon className="text-sm" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alert rules */}
      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-muted">
          <WalletIcon className="text-base text-brand-accent" />
          Smart money alerts
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <label className={labelC}>
            Rule
            <select value={type} onChange={(e) => setType(e.target.value)} className={input}>
              <option value="spend_threshold">Spending over…</option>
              <option value="balance_below">Balance below…</option>
            </select>
          </label>
          {type === "spend_threshold" && (
            <>
              <label className={labelC}>
                Category
                <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="All (or e.g. Food)" className={input} />
              </label>
              <label className={labelC}>
                Per
                <select value={window} onChange={(e) => setWindow(e.target.value)} className={input}>
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
              </label>
            </>
          )}
          <label className={labelC}>
            Amount (₦)
            <input value={threshold} onChange={(e) => setThreshold(e.target.value)} type="number" step="0.01" className={input} />
          </label>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button onClick={saveRule} disabled={aBusy} className="btn-accent rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {aBusy ? "…" : "Add rule"}
          </button>
          {aMsg && <span className="text-sm text-brand-muted">{aMsg}</span>}
        </div>
        <p className="mt-2 text-xs text-brand-muted">
          e.g. &ldquo;spending on Food over ₦20,000 per week&rdquo;, or &ldquo;balance
          below ₦10,000&rdquo;. Checked daily; you&apos;re notified once per crossing.
        </p>

        {rules.length > 0 && (
          <div className="mt-4 divide-y divide-white/5">
            {rules.map((r) => (
              <div key={r.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="truncate">{ruleText(r)}</span>
                <button
                  onClick={async () => {
                    if (confirm("Delete this rule?")) await deleteAlertRule(r.id);
                  }}
                  className="ml-auto p-1 text-brand-muted hover:text-red-400"
                  title="Delete"
                >
                  <TrashIcon className="text-sm" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
