import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Store or remove a browser's Web Push subscription for the signed-in user.
// Uses the authenticated (RLS-scoped) client, so a subscription is always tied
// to the caller's own account.
export const dynamic = "force-dynamic";

type WebPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let sub: WebPushSubscription;
  try {
    sub = (await req.json()) as WebPushSubscription;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad body" }, { status: 400 });
  }
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ ok: false, reason: "invalid subscription" }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let endpoint = "";
  try {
    endpoint = ((await req.json()) as { endpoint?: string }).endpoint ?? "";
  } catch {
    /* ignore */
  }
  if (!endpoint) return NextResponse.json({ ok: false }, { status: 400 });

  // RLS ensures only the caller's own row can be deleted.
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
