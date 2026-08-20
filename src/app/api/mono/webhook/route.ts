import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTransactions, importTransactions } from "@/lib/mono";

// Mono webhook. Mono POSTs events like `mono.events.account_updated` when new
// data is available; we resolve the account to its owner and import the latest
// transactions. Authenticated by the `mono-webhook-secret` header — set the same
// value as MONO_WEBHOOK_SECRET in your Mono dashboard.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.MONO_WEBHOOK_SECRET;
  if (!secret || req.headers.get("mono-webhook-secret") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, reason: "not configured" }, { status: 500 });
  }

  let body: { event?: string; data?: Record<string, unknown> } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // The account id can arrive in a few shapes depending on the event.
  const data = body.data ?? {};
  const account = (data.account ?? {}) as { _id?: string; id?: string };
  const accountId =
    account._id || account.id || (data.id as string) || (data._id as string) || "";
  if (!accountId) return NextResponse.json({ ok: true, skipped: "no account id" });

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Which user owns this account?
  const { data: linked } = await db
    .from("linked_accounts")
    .select("user_id")
    .eq("mono_account_id", accountId)
    .single();
  if (!linked) return NextResponse.json({ ok: true, skipped: "unknown account" });

  const txns = await getTransactions(accountId);
  const imported = await importTransactions(db, linked.user_id, txns);
  await db
    .from("linked_accounts")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("mono_account_id", accountId);

  return NextResponse.json({ ok: true, imported });
}
