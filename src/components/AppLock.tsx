"use client";

import { useEffect, useState } from "react";

// Optional PIN lock for the installed PWA. When a PIN is set (see PinSettings)
// the app is gated behind a lock screen once per browser session. This is a
// convenience lock for a personal phone, not a security boundary — the real
// data protection is Supabase auth + RLS on the server. The PIN is stored only
// as a SHA-256 hash in this browser; it never reaches the server.
//
// While the lock state is unknown (SSR + first paint) we render nothing, so the
// dashboard's contents are never briefly shown behind the lock.
export async function hashPin(pin: string) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(pin),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const PIN_KEY = "dmaths_pin";
const UNLOCKED_KEY = "dmaths_unlocked";

export default function AppLock({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "locked" | "open">("loading");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const hash = localStorage.getItem(PIN_KEY);
    if (!hash) return setState("open"); // no PIN configured
    if (sessionStorage.getItem(UNLOCKED_KEY) === "1") return setState("open");
    setState("locked");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const hash = localStorage.getItem(PIN_KEY);
    if (hash && (await hashPin(pin)) === hash) {
      sessionStorage.setItem(UNLOCKED_KEY, "1");
      setErr("");
      setState("open");
    } else {
      setErr("Wrong PIN. Try again.");
    }
    setPin("");
  }

  if (state === "loading") return null;

  if (state === "locked") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <form onSubmit={submit} className="card w-full max-w-xs p-6 text-center">
          <div className="mb-1 text-lg font-bold">
            D-Maths <span className="text-brand-accent">Assistant</span>
          </div>
          <p className="mb-4 text-sm text-brand-muted">Enter your PIN to unlock.</p>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            type="password"
            inputMode="numeric"
            autoFocus
            placeholder="••••"
            className="w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-brand-accent"
          />
          <button
            type="submit"
            className="mt-3 w-full rounded-lg bg-brand-accent py-2.5 font-semibold text-white"
          >
            Unlock
          </button>
          {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
