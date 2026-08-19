"use client";

import { useEffect, useState } from "react";
import {
  hashPin,
  PIN_KEY,
  BIO_KEY,
  biometricAvailable,
  registerBiometric,
} from "@/components/AppLock";
import { LockIcon } from "@/components/icons";

// Set, change, or remove the PWA PIN lock. Stores only the SHA-256 hash in this
// browser's localStorage — the PIN itself never leaves the device. Biometric
// unlock is an optional extra on top; the PIN is always the fallback.
export default function PinSettings() {
  const [hasPin, setHasPin] = useState(false);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [bioOk, setBioOk] = useState(false);
  const [hasBio, setHasBio] = useState(false);
  const [bioMsg, setBioMsg] = useState("");

  useEffect(() => {
    setHasPin(Boolean(localStorage.getItem(PIN_KEY)));
    setBioOk(biometricAvailable());
    setHasBio(Boolean(localStorage.getItem(BIO_KEY)));
  }, []);

  async function enableBio() {
    setBioMsg("");
    try {
      await registerBiometric();
      setHasBio(true);
      setBioMsg("Biometric unlock on ✓");
    } catch {
      setBioMsg("Couldn't set up biometrics on this device.");
    }
  }

  function disableBio() {
    localStorage.removeItem(BIO_KEY);
    setHasBio(false);
    setBioMsg("Biometric unlock removed.");
  }

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

      {bioOk && hasPin && (
        <div className="mt-4 border-t border-white/5 pt-4">
          <p className="mb-2 text-xs text-brand-muted">
            {hasBio
              ? "Unlock with your fingerprint or face (PIN still works as backup)."
              : "Add fingerprint / face unlock (your PIN stays as the fallback)."}
          </p>
          <div className="flex gap-2">
            {!hasBio ? (
              <button
                type="button"
                onClick={enableBio}
                className="btn-ghost rounded-lg px-4 py-2 text-sm font-semibold"
              >
                Enable biometric unlock
              </button>
            ) : (
              <button
                type="button"
                onClick={disableBio}
                className="rounded-lg border border-brand-border px-4 py-2 text-sm"
              >
                Remove biometrics
              </button>
            )}
          </div>
          {bioMsg && <p className="mt-2 text-sm text-brand-muted">{bioMsg}</p>}
        </div>
      )}
    </div>
  );
}
