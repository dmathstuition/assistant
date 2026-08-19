import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Hit once a day by Vercel Cron (see vercel.json) so the Supabase free-tier
// project registers activity and does not auto-pause after 7 idle days.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, reason: "not configured" });
  }
  const db = createClient(url, serviceKey);
  await db.from("keep_alive").insert({});
  await db
    .from("keep_alive")
    .delete()
    .lt("pinged_at", new Date(Date.now() - 7 * 86400000).toISOString());
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
