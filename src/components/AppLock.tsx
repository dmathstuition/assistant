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
export const BIO_KEY = "dmaths_bio"; // base64 of a registered platform credential id
const UNLOCKED_KEY = "dmaths_unlocked";

const b64 = {
  encode: (buf: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buf))),
  decode: (s: string) =>
    Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

export function biometricAvailable() {
  return typeof window !== "undefined" && "PublicKeyCredential" in window;
}

// Register a platform authenticator (fingerprint/face) and store its id. A PIN
// must already be set so it always remains a fallback — no lock-out risk.
export async function registerBiometric() {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "D-Maths Assistant" },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: "d-maths",
        displayName: "D-Maths",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Registration cancelled.");
  localStorage.setItem(BIO_KEY, b64.encode(cred.rawId));
}

// Prompt the platform authenticator; resolves true only if it verifies.
async function verifyBiometric(): Promise<boolean> {
  const id = localStorage.getItem(BIO_KEY);
  if (!id) return false;
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: b64.decode(id), type: "public-key" }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return Boolean(assertion);
  } catch {
    return false;
  }
}

export default function AppLock({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "locked" | "open">("loading");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [hasBio, setHasBio] = useState(false);

  function unlock() {
    sessionStorage.setItem(UNLOCKED_KEY, "1");
    setErr("");
    setState("open");
  }

  async function tryBio() {
    setErr("");
    if (await verifyBiometric()) unlock();
    else setErr("Biometric unlock failed — use your PIN.");
  }

  useEffect(() => {
    const hash = localStorage.getItem(PIN_KEY);
    if (!hash) return setState("open"); // no PIN configured
    if (sessionStorage.getItem(UNLOCKED_KEY) === "1") return setState("open");
    const bio = Boolean(localStorage.getItem(BIO_KEY));
    setHasBio(bio);
    setState("locked");
    // Offer the biometric prompt immediately when it's set up.
    if (bio) verifyBiometric().then((ok) => ok && unlock());
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const hash = localStorage.getItem(PIN_KEY);
    if (hash && (await hashPin(pin)) === hash) {
      unlock();
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
            className="btn-accent mt-3 w-full rounded-lg py-2.5 font-semibold text-white"
          >
            Unlock
          </button>
          {hasBio && (
            <button
              type="button"
              onClick={tryBio}
              className="btn-ghost mt-2 w-full rounded-lg py-2.5 text-sm font-semibold"
            >
              Use fingerprint / face
            </button>
          )}
          {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
