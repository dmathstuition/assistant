import { NextResponse } from "next/server";
import { authorizeCron, emailsForUsers } from "@/lib/cron";
import { sendPush, pushConfigured, type PushSub } from "@/lib/push";
import { sendMail, appScriptConfigured } from "@/lib/google/appscript";

// Scheduled task alarms that fire even when the app is CLOSED. Meant to be hit
// frequently (every 1–5 minutes) by a free scheduler — an Apps Script time
// trigger or cron-job.org — using ?key=CRON_SECRET. For each timed task it
// pushes a 10-minute warning and a due-time alarm, once each per day
// (task_alerts dedupe), to the user's registered devices (and email as backup).
//
// Times are wall-clock with no zone, so we interpret them in the user's
// timezone via ALARM_TZ_OFFSET (minutes east of UTC; default 60 = WAT).
export const dynamic = "force-dynamic";

type TaskRow = { id: string; user_id: string; title: string; due_time: string | null };

export async function GET(req: Request) {
  const gate = authorizeCron(req);
  if ("error" in gate) return gate.error;
  if (!pushConfigured() && !appScriptConfigured()) {
    return NextResponse.json({ ok: false, reason: "no delivery channel" }, { status: 500 });
  }
  const db = gate.db;

  const offsetMin = Number(process.env.ALARM_TZ_OFFSET ?? 60);
  const windowMin = Number(process.env.ALARM_WINDOW_MIN ?? 6);

  // "Now" in the user's local wall clock.
  const localNow = new Date(Date.now() + offsetMin * 60_000);
  const localDate = localNow.toISOString().slice(0, 10);
  const nowMin = localNow.getUTCHours() * 60 + localNow.getUTCMinutes();

  const { data: tasks } = await db
    .from("tasks")
    .select("id,user_id,title,due_time")
    .eq("due_date", localDate)
    .neq("status", "completed")
    .not("due_time", "is", null);

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // Which (task, kind) alarms already went out today?
  const { data: already } = await db
    .from("task_alerts")
    .select("task_id,kind")
    .eq("alert_date", localDate);
  const done = new Set((already ?? []).map((a) => `${a.task_id}:${a.kind}`));

  const userIds = [...new Set(tasks.map((t) => t.user_id))];
  const subsByUser = new Map<string, (PushSub & { id: string })[]>();
  if (pushConfigured()) {
    const { data: subs } = await db
      .from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth")
      .in("user_id", userIds);
    for (const s of subs ?? []) {
      const list = subsByUser.get(s.user_id) ?? [];
      list.push({ id: s.id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth });
      subsByUser.set(s.user_id, list);
    }
  }
  const emailById = appScriptConfigured()
    ? await emailsForUsers(db, userIds)
    : new Map<string, string>();

  let sent = 0;
  const staleSubIds: string[] = [];

  for (const t of tasks as TaskRow[]) {
    if (!t.due_time) continue;
    const [h, m] = t.due_time.split(":").map(Number);
    const dueMin = h * 60 + (m || 0);

    const checks: { kind: "warn" | "due"; target: number; heading: string }[] = [
      { kind: "warn", target: dueMin - 10, heading: "Task in 10 minutes" },
      { kind: "due", target: dueMin, heading: "Task due now" },
    ];

    for (const c of checks) {
      if (done.has(`${t.id}:${c.kind}`)) continue;
      // Fire if we're inside the [target, target+window) minute window.
      if (nowMin < c.target || nowMin >= c.target + windowMin) continue;

      let delivered = false;
      for (const sub of subsByUser.get(t.user_id) ?? []) {
        const res = await sendPush(sub, {
          title: c.heading,
          body: t.title,
          url: "/planner",
        });
        if (res.ok) delivered = true;
        if (res.gone) staleSubIds.push(sub.id);
      }
      const to = emailById.get(t.user_id);
      if (to) {
        const res = await sendMail(to, c.heading, `<p><b>${escapeHtml(t.title)}</b></p>`);
        if (res.ok) delivered = true;
      }

      if (delivered) {
        await db.from("task_alerts").insert({
          user_id: t.user_id,
          task_id: t.id,
          kind: c.kind,
          alert_date: localDate,
        });
        sent++;
      }
    }
  }

  if (staleSubIds.length) {
    await db.from("push_subscriptions").delete().in("id", staleSubIds);
  }

  return NextResponse.json({ ok: true, sent });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
