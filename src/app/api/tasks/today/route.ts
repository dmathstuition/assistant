import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Today's still-open, timed tasks for the signed-in user — the feed the
// in-app alarm scheduler polls. RLS scopes it to the caller. The client passes
// its own local date so alarms line up with the user's timezone.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ tasks: [] }, { status: 401 });

  const url = new URL(req.url);
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ tasks: [] }, { status: 400 });
  }

  const { data } = await supabase
    .from("tasks")
    .select("id,title,due_time")
    .eq("due_date", date)
    .neq("status", "completed")
    .not("due_time", "is", null);

  return NextResponse.json({ tasks: data ?? [] });
}
