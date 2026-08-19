"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoutIcon } from "@/components/icons";

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
      title="Sign out"
      className="btn-ghost flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-brand-muted hover:text-white"
    >
      <LogoutIcon className="text-base" />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  );
}
