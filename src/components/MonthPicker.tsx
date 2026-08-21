"use client";

import { useRouter } from "next/navigation";
import { CalendarIcon } from "@/components/icons";

// Simple month chooser that navigates to ?month=YYYY-MM on the given path.
export default function MonthPicker({
  path,
  months,
  current,
}: {
  path: string;
  months: string[];
  current: string;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <CalendarIcon className="text-base text-brand-accent" />
      <select
        value={current}
        onChange={(e) => router.push(`${path}?month=${e.target.value}`)}
        className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm outline-none focus:border-brand-accent"
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
