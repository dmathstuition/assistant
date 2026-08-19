"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg(
          "Account created. If email confirmation is ON in Supabase, check your inbox — otherwise you can sign in now.",
        );
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-6 text-center">
        <div className="text-2xl font-bold">
          D-Maths <span className="text-brand-accent">Assistant</span>
        </div>
        <p className="mt-1 text-sm text-brand-muted">
          Your tasks & money in one place.
        </p>
      </div>

      <form onSubmit={submit} className="card space-y-4 p-6">
        <div className="flex rounded-lg bg-brand-bg p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 rounded-md py-2 ${mode === "signin" ? "bg-brand-accent text-white" : "text-brand-muted"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-md py-2 ${mode === "signup" ? "bg-brand-accent text-white" : "text-brand-muted"}`}
          >
            Create account
          </button>
        </div>

        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 outline-none focus:border-brand-accent"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 outline-none focus:border-brand-accent"
        />

        <button
          disabled={busy}
          className="w-full rounded-lg bg-brand-accent py-2.5 font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>

        {msg && <p className="text-sm text-brand-muted">{msg}</p>}
      </form>
    </main>
  );
}
