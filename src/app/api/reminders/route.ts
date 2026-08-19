import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Daily Vercel Cron (see vercel.json). Finds reminders due today across ALL
// users and emails each user their own reminders.
//
// SECURITY MODEL — why this is safe even though it reads every user's rows:
//
// 1. Authorization gate. A cron has no logged-in user, so this endpoint must
//    protect itself. Vercel Cron automatically sends
//    `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET env var is set.
//    We reject any request whose header doesn't match, so the route is NOT an
//    open, unauthenticated endpoint — a random visitor gets 401 and no data.
//
// 2. Service role, server-only. To read reminders belonging to other users the
//    cron uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS. That key is a
//    server-only secret (never NEXT_PUBLIC_*, never shipped to the browser) and
//    is only ever used here behind the CRON_SECRET gate. User-facing code keeps
//    using the anon key + RLS; the service role never touches a browser.
//
// 3. No data egress. The JSON response contains only counts — never reminder
//    text, emails, or user ids — so even an authorized caller can't scrape PII.
//    Each user's reminder is delivered only to that user's own email.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // (1) Only Vercel Cron (or someone holding CRON_SECRET) may run this.
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!url || !serviceKey || !resendKey) {
    return NextResponse.json({ ok: false, reason: "not configured" }, { status: 500 });
  }
  const from =
    process.env.REMINDERS_FROM_EMAIL || "D-Maths Assistant <onboarding@resend.dev>";

  // (2) Service-role client — bypasses RLS to see every user's due reminders.
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Reminders whose remind_at falls within today (UTC) and haven't been sent.
  const now = new Date();
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const { data: due, error } = await db
    .from("reminders")
    .select("id,user_id,title,remind_at,recurring")
    .eq("is_done", false)
    .gte("remind_at", dayStart.toISOString())
    .lt("remind_at", dayEnd.toISOString());

  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  if (!due || due.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // Resolve each user's email from auth.users (not in the public schema, so we
  // use the admin API). One lookup per distinct user.
  const emailById = new Map<string, string>();
  await Promise.all(
    [...new Set(due.map((r) => r.user_id))].map(async (uid) => {
      const { data } = await db.auth.admin.getUserById(uid);
      if (data.user?.email) emailById.set(uid, data.user.email);
    }),
  );

  // (3) Email each reminder to its own owner. Mark one-off reminders done so a
  // second cron run the same day can't double-send; recurring ones are left as
  // is (their remind_at only matches the day it's set for).
  let sent = 0;
  const doneIds: string[] = [];
  for (const r of due) {
    const to = emailById.get(r.user_id);
    if (!to) continue;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from,
        to,
        subject: `Reminder: ${r.title}`,
        html: `<p>This is your D-Maths reminder:</p><p><b>${escapeHtml(
          r.title,
        )}</b></p>`,
      }),
    });
    if (res.ok) {
      sent++;
      if (!r.recurring) doneIds.push(r.id);
    }
  }

  if (doneIds.length) {
    await db.from("reminders").update({ is_done: true }).in("id", doneIds);
  }

  return NextResponse.json({ ok: true, due: due.length, sent });
}

// Reminder titles are user-supplied; escape before dropping into the email HTML.
function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
