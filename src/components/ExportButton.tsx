"use client";

import { useState } from "react";
import { exportToGoogleSheet } from "@/app/actions";

// Pushes the user's full history into a new Google Sheet (via the Apps Script
// bridge) and links them to it. Also offers a plain CSV download that needs no
// Google setup.
export default function ExportButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [url, setUrl] = useState("");

  async function toSheet() {
    setBusy(true);
    setMsg("");
    setUrl("");
    try {
      const link = await exportToGoogleSheet();
      setUrl(link);
      setMsg("Sheet created ✓");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Export failed.");
    }
    setBusy(false);
  }

  return (
    <div className="card p-5">
      <div className="mb-3 text-sm font-semibold text-brand-muted">
        Export your data
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toSheet}
          disabled={busy}
          className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Exporting…" : "Export to Google Sheet"}
        </button>
        <a
          href="/api/export"
          className="rounded-lg border border-brand-border px-4 py-2 text-sm"
        >
          Download CSV
        </a>
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block text-sm text-brand-accent underline"
        >
          Open your Google Sheet →
        </a>
      )}
      {msg && !url && <p className="mt-3 text-sm text-brand-muted">{msg}</p>}
    </div>
  );
}
