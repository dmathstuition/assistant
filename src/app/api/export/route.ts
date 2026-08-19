import { createClient } from "@/lib/supabase/server";

// Streams the signed-in user's expenses + income as a CSV download. Uses the
// authenticated (RLS-scoped) server client, so it only ever returns the
// caller's own rows — no service role here.
export const dynamic = "force-dynamic";

function csvCell(value: string | number | null) {
  const s = String(value ?? "");
  // Quote if the cell could break CSV structure; double embedded quotes.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Not signed in.", { status: 401 });
  }

  const [{ data: expenses }, { data: income }] = await Promise.all([
    supabase
      .from("expenses")
      .select("occurred_on,category,amount,description")
      .order("occurred_on", { ascending: false }),
    supabase
      .from("income")
      .select("occurred_on,source_name,amount,description")
      .order("occurred_on", { ascending: false }),
  ]);

  const rows: (string | number | null)[][] = [
    ["Date", "Type", "Category/Source", "Amount", "Description"],
  ];
  for (const e of expenses ?? [])
    rows.push([e.occurred_on, "Expense", e.category, Number(e.amount), e.description]);
  for (const i of income ?? [])
    rows.push([i.occurred_on, "Income", i.source_name, Number(i.amount), i.description]);

  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const filename = `d-maths-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
