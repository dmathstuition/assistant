"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CalendarIcon, DownloadIcon } from "@/components/icons";

const PERIODS = [
  { key: "day", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "last_month", label: "Last month" },
];

export default function ReportControls() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("period") ?? "month";

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <span className="flex items-center gap-1.5 text-sm text-brand-muted">
        <CalendarIcon className="text-base text-brand-accent" />
        Period
      </span>
      {PERIODS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => router.push(`/report?period=${p.key}`)}
          className={`rounded-full px-3 py-1.5 text-xs transition ${
            current === p.key
              ? "btn-accent text-white"
              : "border border-white/10 bg-white/5 text-brand-muted hover:text-white"
          }`}
        >
          {p.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => window.print()}
        className="btn-ghost ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
      >
        <DownloadIcon className="text-sm" />
        Print / PDF
      </button>
    </div>
  );
}
