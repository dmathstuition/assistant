"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { unlinkAccount } from "@/app/actions";
import { WalletIcon, TrashIcon } from "@/components/icons";

type Account = {
  id: string;
  institution: string | null;
  account_name: string | null;
  mask: string | null;
  last_synced_at: string | null;
};

const MONO_PUBLIC_KEY = process.env.NEXT_PUBLIC_MONO_PUBLIC_KEY;

// Load the Mono Connect widget script once.
function loadMono(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { Connect?: unknown };
    if (w.Connect) return resolve(w.Connect);
    const existing = document.getElementById("mono-connect-js");
    if (existing) {
      existing.addEventListener("load", () => resolve((window as unknown as { Connect?: unknown }).Connect));
      return;
    }
    const s = document.createElement("script");
    s.id = "mono-connect-js";
    s.src = "https://connect.mono.co/connect.js";
    s.onload = () => resolve((window as unknown as { Connect?: unknown }).Connect);
    s.onerror = () => reject(new Error("Failed to load Mono"));
    document.body.appendChild(s);
  });
}

export default function BankConnect({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function connect() {
    setMsg("");
    if (!MONO_PUBLIC_KEY) {
      setMsg("Bank linking isn't configured yet (missing Mono public key).");
      return;
    }
    setBusy(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Connect = (await loadMono()) as any;
      const connect = new Connect({
        key: MONO_PUBLIC_KEY,
        onSuccess: async ({ code }: { code: string }) => {
          const r = await fetch("/api/mono/exchange", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code }),
          });
          const d = await r.json();
          setMsg(d.ok ? `Linked ✓ (${d.imported ?? 0} transactions imported)` : "Could not link account.");
          router.refresh();
        },
        onClose: () => setBusy(false),
      });
      connect.setup();
      connect.open();
    } catch {
      setMsg("Couldn't open the bank connection widget.");
    }
    setBusy(false);
  }

  async function sync() {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/mono/sync", { method: "POST" });
      const d = await r.json();
      setMsg(d.ok ? `Synced ✓ (${d.imported ?? 0} new transactions)` : "Sync failed.");
      router.refresh();
    } catch {
      setMsg("Sync failed.");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={connect}
          disabled={busy}
          className="btn-accent flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          <WalletIcon className="text-base" />
          Connect a bank
        </button>
        {accounts.length > 0 && (
          <button
            type="button"
            onClick={sync}
            disabled={busy}
            className="btn-ghost rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Syncing…" : "Sync now"}
          </button>
        )}
      </div>

      {msg && <p className="text-sm text-brand-muted">{msg}</p>}

      {accounts.length > 0 && (
        <div className="divide-y divide-white/5">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center gap-3 py-3">
              <WalletIcon className="text-base text-brand-accent" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {a.institution ?? "Bank"} {a.mask ? `••${a.mask}` : ""}
                </div>
                <div className="truncate text-xs text-brand-muted">
                  {a.account_name ?? ""}
                  {a.last_synced_at
                    ? ` · synced ${new Date(a.last_synced_at).toLocaleDateString("en-NG")}`
                    : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (confirm("Unlink this bank account?")) await unlinkAccount(a.id);
                }}
                title="Unlink"
                className="ml-auto p-1 text-brand-muted hover:text-red-400"
              >
                <TrashIcon className="text-sm" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
