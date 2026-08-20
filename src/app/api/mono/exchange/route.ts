import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  monoConfigured,
  exchangeCode,
  getAccount,
  getTransactions,
  importTransactions,
} from "@/lib/mono";

// Called by the Connect widget on success: exchanges the code for a Mono account
// id, stores the linked account, and pulls its transactions once.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!monoConfigured())
    return NextResponse.json({ ok: false, reason: "Mono not configured" }, { status: 500 });

  let code = "";
  try {
    code = ((await req.json()) as { code?: string }).code ?? "";
  } catch {
    /* ignore */
  }
  if (!code) return NextResponse.json({ ok: false, reason: "missing code" }, { status: 400 });

  const accountId = await exchangeCode(code);
  if (!accountId)
    return NextResponse.json({ ok: false, reason: "exchange failed" }, { status: 502 });

  const account = await getAccount(accountId);
  await supabase.from("linked_accounts").upsert(
    {
      user_id: user.id,
      mono_account_id: accountId,
      institution: account?.institution ?? null,
      account_name: account?.name ?? null,
      mask: account?.mask ?? null,
      currency: account?.currency ?? "NGN",
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: "mono_account_id" },
  );

  const txns = await getTransactions(accountId);
  const imported = await importTransactions(supabase, user.id, txns);

  return NextResponse.json({ ok: true, imported });
}
