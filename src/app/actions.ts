"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { callAppScript, mirrorTransaction } from "@/lib/google/appscript";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You are not signed in.");
  return { supabase, user };
}

export async function addExpense(formData: FormData) {
  const { supabase, user } = await requireUser();
  const amount = Number(formData.get("amount"));
  if (!amount || amount <= 0) throw new Error("Enter a valid amount.");
  const category = String(formData.get("category") || "Other");
  const description = String(formData.get("description") || "") || null;
  await supabase.from("expenses").insert({
    user_id: user.id,
    amount,
    category,
    description,
    source: "manual",
  });
  await mirrorTransaction({
    kind: "expense",
    amount,
    category,
    description,
    occurred_on: new Date().toISOString().slice(0, 10),
    email: user.email ?? null,
  });
  revalidatePath("/dashboard");
}

export async function addIncome(formData: FormData) {
  const { supabase, user } = await requireUser();
  const amount = Number(formData.get("amount"));
  if (!amount || amount <= 0) throw new Error("Enter a valid amount.");
  const source_name = String(formData.get("source_name") || "Other");
  const description = String(formData.get("description") || "") || null;
  await supabase.from("income").insert({
    user_id: user.id,
    amount,
    source_name,
    description,
    source: "manual",
  });
  await mirrorTransaction({
    kind: "income",
    amount,
    category: source_name,
    description,
    occurred_on: new Date().toISOString().slice(0, 10),
    email: user.email ?? null,
  });
  revalidatePath("/dashboard");
}

export async function addTask(formData: FormData) {
  const { supabase, user } = await requireUser();
  const title = String(formData.get("title") || "").trim();
  if (!title) throw new Error("Enter a task title.");
  const due = String(formData.get("due_date") || "");
  await supabase.from("tasks").insert({
    user_id: user.id,
    title,
    priority: String(formData.get("priority") || "medium"),
    due_date: due || null,
  });
  revalidatePath("/dashboard");
}

export async function toggleTask(id: string, done: boolean) {
  const { supabase } = await requireUser();
  await supabase
    .from("tasks")
    .update({
      status: done ? "completed" : "pending",
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq("id", id);
  revalidatePath("/dashboard");
}

export async function upsertBudget(formData: FormData) {
  const { supabase, user } = await requireUser();
  const category = String(formData.get("category") || "").trim();
  if (!category) throw new Error("Choose a category.");
  const monthly_limit = Number(formData.get("monthly_limit"));
  if (!monthly_limit || monthly_limit <= 0)
    throw new Error("Enter a valid monthly limit.");
  await supabase.from("budgets").upsert(
    {
      user_id: user.id,
      category,
      monthly_limit,
    },
    { onConflict: "user_id,category" },
  );
  revalidatePath("/dashboard");
}

export async function addSavingsGoal(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Enter a goal name.");
  const target_amount = Number(formData.get("target_amount"));
  if (!target_amount || target_amount <= 0)
    throw new Error("Enter a valid target amount.");
  const deadline = String(formData.get("deadline") || "");
  await supabase.from("savings_goals").insert({
    user_id: user.id,
    name,
    target_amount,
    deadline: deadline || null,
  });
  revalidatePath("/dashboard");
}

export async function logContribution(id: string, amount: number) {
  const { supabase } = await requireUser();
  if (!amount || amount <= 0) throw new Error("Enter a valid amount.");
  // Read-then-write: RLS scopes the select to the caller's own row, so a goal
  // that isn't theirs simply returns nothing and the update below is a no-op.
  const { data: goal } = await supabase
    .from("savings_goals")
    .select("current_amount")
    .eq("id", id)
    .single();
  if (!goal) throw new Error("Goal not found.");
  await supabase
    .from("savings_goals")
    .update({ current_amount: Number(goal.current_amount) + amount })
    .eq("id", id);
  revalidatePath("/dashboard");
}

type AssistantAction = {
  intent: string;
  amount?: number | null;
  category?: string | null;
  title?: string | null;
  description?: string | null;
  due_date?: string | null;
};

export async function saveAssistantAction(action: AssistantAction) {
  const { supabase, user } = await requireUser();

  if (action.intent === "expense" && action.amount) {
    await supabase.from("expenses").insert({
      user_id: user.id,
      amount: action.amount,
      category: action.category || "Other",
      description: action.description || null,
      source: "ai",
    });
    await mirrorTransaction({
      kind: "expense",
      amount: action.amount,
      category: action.category || "Other",
      description: action.description || null,
      occurred_on: new Date().toISOString().slice(0, 10),
      email: user.email ?? null,
    });
  } else if (action.intent === "income" && action.amount) {
    await supabase.from("income").insert({
      user_id: user.id,
      amount: action.amount,
      source_name: action.category || "Other",
      description: action.description || null,
      source: "ai",
    });
    await mirrorTransaction({
      kind: "income",
      amount: action.amount,
      category: action.category || "Other",
      description: action.description || null,
      occurred_on: new Date().toISOString().slice(0, 10),
      email: user.email ?? null,
    });
  } else if (action.intent === "task") {
    await supabase.from("tasks").insert({
      user_id: user.id,
      title: action.title || action.description || "New task",
      due_date: action.due_date || null,
    });
  } else if (action.intent === "reminder") {
    await supabase.from("reminders").insert({
      user_id: user.id,
      title: action.title || action.description || "Reminder",
      remind_at: action.due_date
        ? new Date(action.due_date).toISOString()
        : new Date().toISOString(),
    });
  } else if (action.intent === "budget" && action.amount && action.category) {
    await supabase.from("budgets").upsert(
      {
        user_id: user.id,
        category: action.category,
        monthly_limit: action.amount,
      },
      { onConflict: "user_id,category" },
    );
  } else if (action.intent === "goal" && action.amount) {
    await supabase.from("savings_goals").insert({
      user_id: user.id,
      name: action.title || action.description || "Savings goal",
      target_amount: action.amount,
    });
  } else {
    throw new Error("Nothing to save for this request.");
  }
  revalidatePath("/dashboard");
}

export type ImportRow = {
  occurred_on: string | null;
  category: string;
  amount: number;
  description: string | null;
};

// Bulk-insert expenses parsed from a CSV. Rows are validated here; anything
// without a positive amount is skipped. Returns how many were inserted.
export async function importExpenses(rows: ImportRow[]): Promise<number> {
  const { supabase, user } = await requireUser();
  const clean = rows
    .filter((r) => Number(r.amount) > 0)
    .map((r) => ({
      user_id: user.id,
      amount: Number(r.amount),
      category: (r.category || "Other").trim() || "Other",
      description: r.description?.trim() || null,
      occurred_on: r.occurred_on || undefined, // let the DB default to today if absent
      source: "manual" as const,
    }));
  if (clean.length === 0) throw new Error("No valid rows found in that file.");
  const { error } = await supabase.from("expenses").insert(clean);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  return clean.length;
}

// Push the full expense + income history into a brand-new Google Sheet via the
// Apps Script bridge, and return its URL. RLS scopes both reads to the caller.
export async function exportToGoogleSheet(): Promise<string> {
  const { supabase, user } = await requireUser();
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

  const expenseRows = (expenses ?? []).map((e) => [
    e.occurred_on,
    "Expense",
    e.category,
    Number(e.amount),
    e.description ?? "",
  ]);
  const incomeRows = (income ?? []).map((i) => [
    i.occurred_on,
    "Income",
    i.source_name,
    Number(i.amount),
    i.description ?? "",
  ]);

  const res = await callAppScript("export", {
    email: user.email ?? null,
    title: `D-Maths export ${new Date().toISOString().slice(0, 10)}`,
    header: ["Date", "Type", "Category/Source", "Amount", "Description"],
    rows: [...expenseRows, ...incomeRows],
  });

  if (!res.ok || !res.url) {
    throw new Error(
      res.error === "not configured"
        ? "Google export isn't set up yet. Add your Apps Script URL first."
        : "Couldn't build the Google Sheet. Try again.",
    );
  }
  return res.url;
}
