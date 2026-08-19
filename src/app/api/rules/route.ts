import { NextResponse } from "next/server";
import { authorizeCron, emailsForUsers } from "@/lib/cron";
import { sendPush, pushConfigured, type PushSub } from "@/lib/push";
import { sendMail, appScriptConfigured } from "@/lib/google/appscript";

// Evaluate user-defined alert rules and notify when they trigger. Meant to run
// daily (see vercel.json). Same security model as the other crons: CRON_SECRET
// gate + service-role client. last_notified_period de-duplicates so each
// crossing notifies once.
export const dynamic = "force-dynamic";

type Rule = {
  id: string;
  user_id: string;
  type: "spend_threshold" | "balance_below";
  category: string | null;
  time_window: "day" | "week" | "month" | null;
  threshold: number;
  last_notified_period: string | null;
};

const sum = (rows: { amount: number | string }[] | null) =>
  (rows ?? []).reduce((t, r) => t + (Number(r.amount) || 0), 0);

function windowStartLocal(window: string, offsetMin: number) {
  const local = new Date(Date.now() + offsetMin * 60_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  if (window === "day") return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
  if (window === "month") return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  // week — Monday
  const monday = new Date(Date.UTC(y, m, d));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const gate = authorizeCron(req);
  if ("error" in gate) return gate.error;
  if (!pushConfigured() && !appScriptConfigured()) {
    return NextResponse.json({ ok: false, reason: "no delivery channel" }, { status: 500 });
  }
  const db = gate.db;
  const offsetMin = Number(process.env.ALARM_TZ_OFFSET ?? 60);

  const { data: rules } = await db
    .from("alert_rules")
    .select("id,user_id,type,category,time_window,threshold,last_notified_period")
    .eq("active", true);

  if (!rules || rules.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const emailById = appScriptConfigured()
    ? await emailsForUsers(db, rules.map((r) => r.user_id))
    : new Map<string, string>();

  const subsCache = new Map<string, (PushSub & { id: string })[]>();
  async function subsFor(userId: string) {
    if (!pushConfigured()) return [];
    if (subsCache.has(userId)) return subsCache.get(userId)!;
    const { data } = await db
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("user_id", userId);
    const list = (data ?? []) as (PushSub & { id: string })[];
    subsCache.set(userId, list);
    return list;
  }

  async function notify(userId: string, title: string, body: string) {
    let ok = false;
    for (const s of await subsFor(userId)) {
      const res = await sendPush(s, { title, body, url: "/analytics" });
      if (res.ok) ok = true;
      if (res.gone) await db.from("push_subscriptions").delete().eq("id", s.id);
    }
    const to = emailById.get(userId);
    if (to && appScriptConfigured()) {
      const res = await sendMail(to, title, `<p>${body}</p>`);
      if (res.ok) ok = true;
    }
    return ok;
  }

  let sent = 0;
  for (const rule of rules as Rule[]) {
    if (rule.type === "spend_threshold") {
      const window = rule.time_window ?? "week";
      const start = windowStartLocal(window, offsetMin);
      let q = db
        .from("expenses")
        .select("amount")
        .eq("user_id", rule.user_id)
        .gte("occurred_on", start);
      if (rule.category) q = q.ilike("category", rule.category);
      const { data } = await q;
      const spent = sum(data);
      const period = `${window}:${start}`;
      if (spent > rule.threshold && rule.last_notified_period !== period) {
        const where = rule.category ? ` on ${rule.category}` : "";
        const ok = await notify(
          rule.user_id,
          "Spending alert",
          `You've spent ₦${Math.round(spent).toLocaleString()}${where} this ${window} — over your ₦${Math.round(rule.threshold).toLocaleString()} limit.`,
        );
        if (ok) {
          await db.from("alert_rules").update({ last_notified_period: period }).eq("id", rule.id);
          sent++;
        }
      }
    } else if (rule.type === "balance_below") {
      const [{ data: inc }, { data: exp }] = await Promise.all([
        db.from("income").select("amount").eq("user_id", rule.user_id),
        db.from("expenses").select("amount").eq("user_id", rule.user_id),
      ]);
      const balance = sum(inc) - sum(exp);
      if (balance < rule.threshold) {
        if (rule.last_notified_period !== "below") {
          const ok = await notify(
            rule.user_id,
            "Low balance",
            `Your balance is ₦${Math.round(balance).toLocaleString()}, below your ₦${Math.round(rule.threshold).toLocaleString()} threshold.`,
          );
          if (ok) {
            await db.from("alert_rules").update({ last_notified_period: "below" }).eq("id", rule.id);
            sent++;
          }
        }
      } else if (rule.last_notified_period === "below") {
        // Recovered — reset so a future dip notifies again.
        await db.from("alert_rules").update({ last_notified_period: null }).eq("id", rule.id);
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
