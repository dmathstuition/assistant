import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeCron } from "@/lib/cron";
import { parseBankEmail } from "@/lib/emailParse";

// Ingest a bank "transaction alert" email and turn it into an expense (debit)
// or income (credit), de-duplicated by the Gmail message id. Driven by the
// Apps Script scanner (google-appscript/Code.gs → scanBankEmails), which POSTs
// raw email fields here with ?key=CRON_SECRET. Parsing lives in TypeScript
// (src/lib/emailParse.ts) so it can be tuned without redeploying Apps Script.
export const dynamic = "force-dynamic";

// Resolve which user this belongs to. Single-user app: match the posted email,
// else fall back to the sole account.
async function resolveUserId(db: SupabaseClient, email?: string | null) {
  const { data } = await db.auth.admin.listUsers();
  const users = data?.users ?? [];
  if (email) {
    const hit = users.find(
      (u) => u.email?.toLowerCase() === String(email).toLowerCase(),
    );
    if (hit) return hit.id;
  }
  return users.length === 1 ? users[0].id : null;
}

export async function POST(req: Request) {
  const gate = authorizeCron(req);
  if ("error" in gate) return gate.error;
  const db = gate.db;

  let payload: {
    messageId?: string;
    from?: string;
    subject?: string;
    body?: string;
    receivedAt?: string;
    email?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad json" }, { status: 400 });
  }
  if (!payload.messageId) {
    return NextResponse.json({ ok: false, reason: "missing messageId" }, { status: 400 });
  }

  const parsed = parseBankEmail(payload);
  if (!parsed) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no amount found" });
  }

  const userId = await resolveUserId(db, payload.email);
  if (!userId) {
    return NextResponse.json({ ok: false, reason: "no user" }, { status: 404 });
  }

  const external_id = `email:${payload.messageId}`;

  if (parsed.kind === "expense") {
    const { error } = await db.from("expenses").insert({
      user_id: userId,
      amount: parsed.amount,
      category: parsed.category,
      description: parsed.description,
      occurred_on: parsed.occurred_on,
      source: "bank",
      external_id,
    });
    if (error) {
      // 23505 = unique violation → we've already imported this alert.
      if (error.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
      return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    }
  } else {
    const { error } = await db.from("income").insert({
      user_id: userId,
      amount: parsed.amount,
      source_name: parsed.category,
      description: parsed.description,
      occurred_on: parsed.occurred_on,
      source: "bank",
      external_id,
    });
    if (error) {
      if (error.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
      return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    created: true,
    kind: parsed.kind,
    amount: parsed.amount,
    category: parsed.category,
  });
}
