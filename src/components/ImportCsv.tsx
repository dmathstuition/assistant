"use client";

import { useState } from "react";
import { importExpenses, type ImportRow } from "@/app/actions";
import { UploadIcon } from "@/components/icons";

// Minimal CSV parser: handles quoted fields and escaped quotes. Good enough for
// bank/exported CSVs; not a full RFC-4180 implementation.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    if (row.some((c) => c.trim() !== "")) rows.push(row);
  }
  return rows;
}

// Map header names (case-insensitive) to the fields we need.
function columnIndex(header: string[]) {
  const find = (...names: string[]) =>
    header.findIndex((h) => names.includes(h.trim().toLowerCase()));
  return {
    date: find("date", "occurred_on", "day"),
    category: find("category", "source", "type"),
    amount: find("amount", "value", "total"),
    description: find("description", "note", "memo", "details"),
  };
}

function toRows(text: string): ImportRow[] {
  const grid = parseCsv(text);
  if (grid.length < 2) return [];
  const idx = columnIndex(grid[0]);
  if (idx.amount < 0) return []; // amount is the one required column
  return grid.slice(1).map((r) => ({
    occurred_on: idx.date >= 0 ? normalizeDate(r[idx.date]) : null,
    category: idx.category >= 0 ? r[idx.category] : "Other",
    amount: Number((r[idx.amount] ?? "").replace(/[₦,\s]/g, "")),
    description: idx.description >= 0 ? r[idx.description] : null,
  }));
}

function normalizeDate(v: string | undefined): string | null {
  if (!v) return null;
  const d = new Date(v.trim());
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export default function ImportCsv() {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setMsg("");
    setRows([]);
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = toRows(text).filter((r) => Number(r.amount) > 0);
    if (parsed.length === 0) {
      setMsg("Couldn't find rows with an Amount column. Check the CSV headers.");
      return;
    }
    setRows(parsed);
    setMsg(`${parsed.length} expense${parsed.length > 1 ? "s" : ""} ready to import.`);
  }

  async function doImport() {
    setBusy(true);
    try {
      const n = await importExpenses(rows);
      setMsg(`Imported ${n} expense${n > 1 ? "s" : ""} ✓`);
      setRows([]);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Import failed.");
    }
    setBusy(false);
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-muted">
        <UploadIcon className="text-base text-brand-accent" />
        Import expenses (CSV)
      </div>
      <p className="mb-3 text-xs text-brand-muted">
        Columns: Amount (required), plus Date, Category, Description if present.
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={onFile}
        className="block w-full text-sm text-brand-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
      />
      {rows.length > 0 && (
        <button
          type="button"
          onClick={doImport}
          disabled={busy}
          className="mt-3 rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Importing…" : `Import ${rows.length}`}
        </button>
      )}
      {msg && <p className="mt-3 text-sm text-brand-muted">{msg}</p>}
    </div>
  );
}
