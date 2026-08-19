import { NextResponse } from "next/server";
import { authorizeCron, emailsForUsers } from "@/lib/cron";
import { sendMail, appScriptConfigured } from "@/lib/google/appscript";

// Daily budget-alert cron (see vercel.json). For every user's budget, compares
// this month's spend against the limit and emails a one-time alert when spend
// crosses 80% and again at 100%. A budget_alerts row per (category, threshold,
// month) makes each crossing fire exactly once.
//
// Security: same model as the reminders cron — CRON_SECRET bearer gate + a
// service-role client used only behind that gate; the response carries counts
// only, never user data.
export const dynamic = "force-dynamic";

const THRESHOLDS = [80, 100] as const;

function num(v: number | string | null) {
  return Number(v) || 0;
}

export async function GET(req: Request) {
  const gate = authorizeCron(req);
  if ("error" in gate) return gate.error;
  if (!appScriptConfigured()) {
    return NextResponse.json({ ok: false, reason: "mail not configured" }, { status: 500 });
  }
  const db = gate.db;

  // This month's window and its 'YYYY-MM' key.
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const startISO = start.toISOString().slice(0, 10);
  const nextISO = next.toISOString().slice(0, 10);
  const period = startISO.slice(0, 7);

  const [{ data: budgets }, { data: expenses }, { data: alerted }] =
    await Promise.all([
      db.from("budgets").select("user_id,category,monthly_limit"),
      db
        .from("expenses")
        .select("user_id,category,amount")
        .gte("occurred_on", startISO)
        .lt("occurred_on", nextISO),
      db.from("budget_alerts").select("user_id,category,threshold").eq("period", period),
    ]);

  if (!budgets || budgets.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // Spend per (user, lower-cased category) this month.
  const spend = new Map<string, number>();
  for (const e of expenses ?? []) {
    const key = `${e.user_id}::${String(e.category ?? "Other").toLowerCase()}`;
    spend.set(key, (spend.get(key) ?? 0) + num(e.amount));
  }

  // Alerts already sent this month, so we don't repeat a crossing.
  const already = new Set(
    (alerted ?? []).map(
      (a) => `${a.user_id}::${a.category.toLowerCase()}::${a.threshold}`,
    ),
  );

  const emailById = await emailsForUsers(
    db,
    budgets.map((b) => b.user_id),
  );

  let sent = 0;
  for (const b of budgets) {
    const limit = num(b.monthly_limit);
    if (limit <= 0) continue;
    const catKey = String(b.category).toLowerCase();
    const spent = spend.get(`${b.user_id}::${catKey}`) ?? 0;
    const pct = (spent / limit) * 100;
    const to = emailById.get(b.user_id);
    if (!to) continue;

    // Highest crossed threshold that hasn't been alerted yet.
    for (const t of [...THRESHOLDS].reverse()) {
      if (pct < t) continue;
      const dedupe = `${b.user_id}::${catKey}::${t}`;
      if (already.has(dedupe)) break; // this or a higher threshold already sent
      const res = await sendMail(
        to,
        `Budget alert: ${b.category} at ${Math.round(pct)}%`,
        `<p>Heads up — you've used <b>${Math.round(pct)}%</b> of your ${b.category} budget this month (₦${spent.toLocaleString()} of ₦${limit.toLocaleString()}).</p>`,
      );
      if (res.ok) {
        await db
          .from("budget_alerts")
          .insert({ user_id: b.user_id, category: b.category, threshold: t, period });
        already.add(dedupe);
        sent++;
      }
      break; // only the highest crossed threshold per run
    }
  }

  return NextResponse.json({ ok: true, sent });
}
