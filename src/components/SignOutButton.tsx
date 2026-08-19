"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  async function out() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      onClick={out}
      className="rounded-lg border border-brand-border px-3 py-1.5 text-sm text-brand-muted hover:text-white"
    >
      Sign out
    </button>
  );
}
