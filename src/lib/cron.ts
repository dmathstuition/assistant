import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Shared setup for Vercel Cron routes. Enforces the CRON_SECRET bearer gate
// (so the endpoint is never open) and hands back a service-role client that
// bypasses RLS — safe only behind that gate. See the reminders route for the
// full security rationale.
export function authorizeCron(
  req: Request,
): { db: SupabaseClient } | { error: NextResponse } {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return {
      error: NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 }),
    };
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return {
      error: NextResponse.json({ ok: false, reason: "not configured" }, { status: 500 }),
    };
  }
  return { db: createClient(url, serviceKey, { auth: { persistSession: false } }) };
}

// Resolve user ids to emails via the admin API (auth.users isn't in the public
// schema). One lookup per distinct id.
export async function emailsForUsers(db: SupabaseClient, userIds: string[]) {
  const map = new Map<string, string>();
  await Promise.all(
    [...new Set(userIds)].map(async (uid) => {
      const { data } = await db.auth.admin.getUserById(uid);
      if (data.user?.email) map.set(uid, data.user.email);
    }),
  );
  return map;
}
