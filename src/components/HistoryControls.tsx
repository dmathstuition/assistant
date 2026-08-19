"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FilterIcon } from "@/components/icons";

// Filter controls for the history page. Writes the chosen filters into the URL
// query so the server component can re-query. One row above the list.
export default function HistoryControls({ months }: { months: string[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/history?${next.toString()}`);
  }

  const select =
    "rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm outline-none focus:border-brand-accent";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-sm text-brand-muted">
        <FilterIcon className="text-base text-brand-accent" />
        Filter
      </span>
      <select
        value={params.get("type") ?? ""}
        onChange={(e) => set("type", e.target.value)}
        className={select}
      >
        <option value="">All types</option>
        <option value="expense">Expenses</option>
        <option value="income">Income</option>
      </select>
      <select
        value={params.get("month") ?? ""}
        onChange={(e) => set("month", e.target.value)}
        className={select}
      >
        <option value="">All months</option>
        {months.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <input
        defaultValue={params.get("category") ?? ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") set("category", (e.target as HTMLInputElement).value);
        }}
        onBlur={(e) => set("category", e.target.value)}
        placeholder="Category…"
        className={select}
      />
    </div>
  );
}
