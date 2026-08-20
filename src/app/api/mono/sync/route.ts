import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { monoConfigured, getTransactions, importTransactions } from "@/lib/mono";

// Pull the latest transactions for the signed-in user's linked accounts and
// import new debits as expenses. Triggered by the "Sync now" button.
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!monoConfigured())
    return NextResponse.json({ ok: false, reason: "Mono not configured" }, { status: 500 });

  const { data: accounts } = await supabase
    .from("linked_accounts")
    .select("mono_account_id");

  let imported = 0;
  for (const a of accounts ?? []) {
    const txns = await getTransactions(a.mono_account_id);
    imported += await importTransactions(supabase, user.id, txns);
    await supabase
      .from("linked_accounts")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("mono_account_id", a.mono_account_id);
  }

  return NextResponse.json({ ok: true, imported });
}
