"use client";

import { useEffect, useState } from "react";
import { hashPin, PIN_KEY } from "@/components/AppLock";
import { LockIcon } from "@/components/icons";

// Set, change, or remove the PWA PIN lock. Stores only the SHA-256 hash in this
// browser's localStorage — the PIN itself never leaves the device.
export default function PinSettings() {
  const [hasPin, setHasPin] = useState(false);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setHasPin(Boolean(localStorage.getItem(PIN_KEY)));
  }, []);

  async function save() {
    if (pin.trim().length < 4) {
      setMsg("Use at least 4 digits.");
      return;
    }
    localStorage.setItem(PIN_KEY, await hashPin(pin.trim()));
    sessionStorage.setItem("dmaths_unlocked", "1"); // stay unlocked now
    setHasPin(true);
    setPin("");
    setMsg("PIN lock is on ✓");
  }

  function remove() {
    localStorage.removeItem(PIN_KEY);
    setHasPin(false);
    setMsg("PIN lock removed.");
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-muted">
        <LockIcon className="text-base text-brand-accent" />
        App lock (PIN)
      </div>
      <p className="mb-3 text-xs text-brand-muted">
        {hasPin
          ? "This device asks for your PIN once per session."
          : "Add a PIN to lock the app on this device."}
      </p>
      <div className="flex gap-2">
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          type="password"
          inputMode="numeric"
          placeholder={hasPin ? "New PIN" : "Choose a PIN"}
          className="w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 outline-none focus:border-brand-accent"
        />
        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white"
        >
          {hasPin ? "Update" : "Set"}
        </button>
        {hasPin && (
          <button
            type="button"
            onClick={remove}
            className="rounded-lg border border-brand-border px-4 py-2 text-sm"
          >
            Remove
          </button>
        )}
      </div>
      {msg && <p className="mt-3 text-sm text-brand-muted">{msg}</p>}
    </div>
  );
}
