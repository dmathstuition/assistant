"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "@/components/icons";

// Search input that navigates to /search?q=…
export default function SearchBox({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query) router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <form onSubmit={submit} className="relative">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-brand-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search transactions, tasks, reminders…"
        className="w-full rounded-lg border border-brand-border bg-brand-bg py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-accent"
      />
    </form>
  );
}
