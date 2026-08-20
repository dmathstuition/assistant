import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Receives entries captured while the device was offline and inserts them for
// the signed-in user (RLS-scoped). Expenses/income/tasks only — the same fields
// the Quick-Add form uses.
export const dynamic = "force-dynamic";

type Item = { type: string; data: Record<string, string> };

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let items: Item[] = [];
  try {
    items = ((await req.json()) as { items?: Item[] }).items ?? [];
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const expenses: Record<string, unknown>[] = [];
  const income: Record<string, unknown>[] = [];
  const tasks: Record<string, unknown>[] = [];

  for (const it of items) {
    const d = it.data || {};
    const amount = Number(d.amount);
    if (it.type === "expense" && amount > 0) {
      expenses.push({
        user_id: user.id,
        amount,
        category: (d.category || "Other").trim() || "Other",
        description: d.description?.trim() || null,
        source: "manual",
      });
    } else if (it.type === "income" && amount > 0) {
      income.push({
        user_id: user.id,
        amount,
        source_name: (d.source_name || "Other").trim() || "Other",
        description: d.description?.trim() || null,
        source: "manual",
      });
    } else if (it.type === "task" && d.title?.trim()) {
      tasks.push({
        user_id: user.id,
        title: d.title.trim(),
        priority: d.priority || "medium",
        due_date: d.due_date || null,
        due_time: d.due_time || null,
      });
    }
  }

  let saved = 0;
  if (expenses.length) {
    const { error } = await supabase.from("expenses").insert(expenses);
    if (!error) saved += expenses.length;
  }
  if (income.length) {
    const { error } = await supabase.from("income").insert(income);
    if (!error) saved += income.length;
  }
  if (tasks.length) {
    const { error } = await supabase.from("tasks").insert(tasks);
    if (!error) saved += tasks.length;
  }

  return NextResponse.json({ ok: true, saved });
}
