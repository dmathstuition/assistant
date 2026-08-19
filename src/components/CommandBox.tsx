"use client";

import { useState } from "react";
import { saveAssistantAction } from "@/app/actions";
import { naira } from "@/components/Naira";

type Action = {
  intent: string;
  amount?: number | null;
  category?: string | null;
  title?: string | null;
  description?: string | null;
  due_date?: string | null;
};

const SUGGESTIONS = [
  "I spent 8,500 naira on transport",
  "I earned ₦250,000 from teaching",
  "Add a task to mark Year 5 assignments tomorrow",
  "Remind me to review my budget on Monday",
];

export default function CommandBox() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [msg, setMsg] = useState("");

  async function ask(q?: string) {
    const question = (q ?? text).trim();
    if (!question) return;
    setBusy(true);
    setMsg("");
    setAction(null);
    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const d = await r.json();
      if (d.error) setMsg(d.error);
      else if (d.action?.intent === "query")
        setMsg(
          "Data questions (\"how much did I spend?\") are coming in the next build. For now I can record expenses, income, tasks and reminders.",
        );
      else if (!d.action || d.action.intent === "unknown")
        setMsg("I couldn't understand that. Try rephrasing.");
      else setAction(d.action as Action);
    } catch {
      setMsg("Something went wrong reaching the assistant.");
    }
    setBusy(false);
  }

  async function confirm() {
    if (!action) return;
    setBusy(true);
    try {
      await saveAssistantAction(action);
      setMsg("Saved \u2713");
      setAction(null);
      setText("");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Could not save.");
    }
    setBusy(false);
  }

  function listen() {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setMsg("Voice input isn't supported in this browser (try Chrome).");
      return;
    }
    const rec = new SR();
    rec.lang = "en-NG";
    rec.onresult = (e: SpeechResultLike) =>
      setText(e.results[0][0].transcript);
    rec.start();
  }

  return (
    <div className="card p-5">
      <div className="mb-3 text-sm font-semibold text-brand-muted">
        Ask your assistant
      </div>

      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. I spent 4,500 on lunch"
          rows={2}
          className="flex-1 resize-none rounded-lg border border-brand-border bg-brand-bg px-3 py-2 outline-none focus:border-brand-accent"
        />
        <div className="flex flex-col gap-2">
          <button
            onClick={() => ask()}
            disabled={busy}
            className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "…" : "Ask"}
          </button>
          <button
            onClick={listen}
            type="button"
            className="rounded-lg border border-brand-border px-4 py-2 text-sm"
            title="Voice input"
          >
            🎤
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setText(s);
              ask(s);
            }}
            className="rounded-full border border-brand-border px-3 py-1 text-xs text-brand-muted hover:text-white"
          >
            {s}
          </button>
        ))}
      </div>

      {action && (
        <div className="mt-4 rounded-lg border border-brand-accent/40 bg-brand-bg p-4">
          <div className="text-sm">
            I understood a <b className="text-brand-accent">{action.intent}</b>:
            <ul className="mt-2 space-y-1 text-brand-muted">
              {action.amount ? <li>Amount: {naira(action.amount)}</li> : null}
              {action.category ? <li>Category: {action.category}</li> : null}
              {action.title ? <li>Title: {action.title}</li> : null}
              {action.due_date ? <li>Date: {action.due_date}</li> : null}
            </ul>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={confirm}
              disabled={busy}
              className="rounded-lg bg-brand-accent px-4 py-1.5 text-sm font-semibold text-white"
            >
              Save
            </button>
            <button
              onClick={() => setAction(null)}
              className="rounded-lg border border-brand-border px-4 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {msg && <p className="mt-3 text-sm text-brand-muted">{msg}</p>}
    </div>
  );
}

// Minimal typings for the browser Web Speech API (avoids extra deps).
interface SpeechResultLike {
  results: { [i: number]: { [j: number]: { transcript: string } } };
}
interface SpeechRecognitionLike {
  lang: string;
  onresult: (e: SpeechResultLike) => void;
  start: () => void;
}
