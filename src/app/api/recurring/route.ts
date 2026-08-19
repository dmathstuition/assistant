import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";

// Daily cron (see vercel.json). Auto-creates the transaction for every
// recurring rule whose next_run is due (catching up if several periods have
// passed), then advances next_run. Same security as the other crons:
// CRON_SECRET gate + service-role client used only behind it.
export const dynamic = "force-dynamic";

function advance(dateISO: string, frequency: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  if (frequency === "daily") base.setUTCDate(base.getUTCDate() + 1);
  else if (frequency === "weekly") base.setUTCDate(base.getUTCDate() + 7);
  else base.setUTCMonth(base.getUTCMonth() + 1); // monthly
  return base.toISOString().slice(0, 10);
}

type Rule = {
  id: string;
  user_id: string;
  kind: "expense" | "income";
  amount: number;
  category: string;
  description: string | null;
  frequency: string;
  next_run: string;
};

export async function GET(req: Request) {
  const gate = authorizeCron(req);
  if ("error" in gate) return gate.error;
  const db = gate.db;

  const today = new Date().toISOString().slice(0, 10);
  const { data: rules, error } = await db
    .from("recurring_rules")
    .select("id,user_id,kind,amount,category,description,frequency,next_run")
    .eq("active", true)
    .lte("next_run", today);

  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }

  let created = 0;
  for (const r of (rules as Rule[]) ?? []) {
    let next = r.next_run;
    let guard = 0;
    // Insert an occurrence for each due period; cap to avoid runaway loops.
    while (next <= today && guard < 62) {
      if (r.kind === "expense") {
        await db.from("expenses").insert({
          user_id: r.user_id,
          amount: r.amount,
          category: r.category,
          description: r.description,
          occurred_on: next,
          source: "manual",
        });
      } else {
        await db.from("income").insert({
          user_id: r.user_id,
          amount: r.amount,
          source_name: r.category,
          description: r.description,
          occurred_on: next,
          source: "manual",
        });
      }
      created++;
      next = advance(next, r.frequency);
      guard++;
    }
    await db.from("recurring_rules").update({ next_run: next }).eq("id", r.id);
  }

  return NextResponse.json({ ok: true, created });
}
