import { NextResponse } from "next/server";
import { authorizeCron, emailsForUsers } from "@/lib/cron";
import { callAppScript, appScriptConfigured } from "@/lib/google/appscript";

// Monthly summary cron (see vercel.json — runs on the 1st). For each user it
// totals LAST month's income/expenses, finds the top spending category and
// current goal progress, then asks the Apps Script bridge to save a Google Doc
// to Drive and email it.
//
// Security: CRON_SECRET bearer gate + service-role client, same as the other
// crons; only counts leave in the response.
export const dynamic = "force-dynamic";

function num(v: number | string | null) {
  return Number(v) || 0;
}

export async function GET(req: Request) {
  const gate = authorizeCron(req);
  if ("error" in gate) return gate.error;
  if (!appScriptConfigured()) {
    return NextResponse.json({ ok: false, reason: "google not configured" }, { status: 500 });
  }
  const db = gate.db;

  // Last month's window.
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startISO = start.toISOString().slice(0, 10);
  const endISO = end.toISOString().slice(0, 10);
  const monthLabel = start.toLocaleDateString("en-NG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const [{ data: expenses }, { data: income }, { data: goals }] =
    await Promise.all([
      db
        .from("expenses")
        .select("user_id,category,amount")
        .gte("occurred_on", startISO)
        .lt("occurred_on", endISO),
      db
        .from("income")
        .select("user_id,amount")
        .gte("occurred_on", startISO)
        .lt("occurred_on", endISO),
      db.from("savings_goals").select("user_id,name,current_amount,target_amount"),
    ]);

  // Aggregate per user.
  type Agg = {
    income: number;
    expenses: number;
    byCategory: Map<string, number>;
  };
  const perUser = new Map<string, Agg>();
  const ensure = (uid: string) => {
    let a = perUser.get(uid);
    if (!a) {
      a = { income: 0, expenses: 0, byCategory: new Map() };
      perUser.set(uid, a);
    }
    return a;
  };

  for (const e of expenses ?? []) {
    const a = ensure(e.user_id);
    const amt = num(e.amount);
    a.expenses += amt;
    const c = String(e.category ?? "Other");
    a.byCategory.set(c, (a.byCategory.get(c) ?? 0) + amt);
  }
  for (const i of income ?? []) ensure(i.user_id).income += num(i.amount);

  const goalsByUser = new Map<string, { name: string; current: number; target: number }[]>();
  for (const g of goals ?? []) {
    const list = goalsByUser.get(g.user_id) ?? [];
    list.push({
      name: g.name,
      current: num(g.current_amount),
      target: num(g.target_amount),
    });
    goalsByUser.set(g.user_id, list);
  }

  if (perUser.size === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const emailById = await emailsForUsers(db, [...perUser.keys()]);

  let sent = 0;
  for (const [uid, a] of perUser) {
    const email = emailById.get(uid);
    let topCategory = "";
    let topAmount = 0;
    for (const [c, amt] of a.byCategory) {
      if (amt > topAmount) {
        topAmount = amt;
        topCategory = c;
      }
    }
    const res = await callAppScript("summary", {
      email: email ?? null,
      month: monthLabel,
      income: Math.round(a.income),
      expenses: Math.round(a.expenses),
      net: Math.round(a.income - a.expenses),
      topCategory,
      topAmount: Math.round(topAmount),
      goals: goalsByUser.get(uid) ?? [],
    });
    if (res.ok) sent++;
  }

  return NextResponse.json({ ok: true, users: perUser.size, sent });
}
