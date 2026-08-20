"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FilterIcon } from "@/components/icons";

export const RANGES: { key: string; label: string }[] = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "3m", label: "Last 3 months" },
  { key: "6m", label: "Last 6 months" },
  { key: "12m", label: "Last 12 months" },
  { key: "ytd", label: "This year" },
];

export default function AnalyticsControls() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("range") ?? "6m";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-sm text-brand-muted">
        <FilterIcon className="text-base text-brand-accent" />
        Period
      </span>
      {RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => router.push(`/analytics?range=${r.key}`)}
          className={`rounded-full px-3 py-1.5 text-xs transition ${
            current === r.key
              ? "btn-accent text-white"
              : "border border-brand-border bg-brand-fg/5 text-brand-muted hover:text-brand-fg"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
