"use client";

import { useState } from "react";
import { SparklesIcon } from "@/components/icons";

// Asks the AI to phrase the report's real figures into a summary + tips.
export default function AiReport({ summary }: { summary: Record<string, unknown> }) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [recs, setRecs] = useState<string[]>([]);
  const [err, setErr] = useState("");

  async function generate() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(summary),
      });
      const d = await r.json();
      if (d.error) setErr(d.error);
      else {
        setText(d.summary ?? "");
        setRecs(Array.isArray(d.recommendations) ? d.recommendations : []);
      }
    } catch {
      setErr("Couldn't reach the AI. Try again.");
    }
    setBusy(false);
  }

  return (
    <div className="card p-5 print:border print:shadow-none">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-brand-muted">
          <SparklesIcon className="text-base text-brand-accent" />
          AI summary &amp; recommendations
        </div>
        {!text && (
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="btn-accent rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60 print:hidden"
          >
            {busy ? "Analysing…" : "Generate"}
          </button>
        )}
      </div>

      {err && <p className="text-sm text-red-400">{err}</p>}

      {!text && !err && (
        <p className="text-sm text-brand-muted">
          Tap Generate for a plain-English overview and tailored tips based on the
          figures above.
        </p>
      )}

      {text && (
        <>
          <p className="text-sm leading-relaxed">{text}</p>
          {recs.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {recs.map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-accent" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
