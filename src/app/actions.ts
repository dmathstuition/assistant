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
  const source_name = String(formData.get("source_name") || "Other").trim() || "Other";
  const category = String(formData.get("category") || "").trim() || null;
  const account = String(formData.get("account") || "").trim() || null;
  const description = String(formData.get("description") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const occurred_on =
    String(formData.get("occurred_on") || "") || new Date().toISOString().slice(0, 10);

  await supabase.from("income").insert({
    user_id: user.id,
    amount,
    source_name,
    category,
    account,
    description,
    notes,
    occurred_on,
    source: "manual",
  });

  // "Recurring" income also creates a rule so it auto-logs going forward.
  const recurrence = String(formData.get("recurrence") || "");
  if (["daily", "weekly", "monthly"].includes(recurrence)) {
    await supabase.from("recurring_rules").insert({
      user_id: user.id,
      kind: "income",
      amount,
      category: source_name,
      description,
      frequency: recurrence,
      next_run: advanceDate(occurred_on, recurrence),
    });
  }

  await mirrorTransaction({
    kind: "income",
    amount,
    category: source_name,
    description,
    occurred_on,
    email: user.email ?? null,
  });
  revalidateAll();
}

const RECURRENCE = ["daily", "weekly", "monthly"];

function taskFieldsFrom(formData: FormData) {
  const recurrenceRaw = String(formData.get("recurrence") || "");
  const reminder = String(formData.get("reminder_minutes") || "");
  return {
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || "").trim() || null,
    category: String(formData.get("category") || "").trim() || null,
    priority: String(formData.get("priority") || "medium"),
    status: String(formData.get("status") || "pending"),
    due_date: String(formData.get("due_date") || "") || null,
    due_time: String(formData.get("due_time") || "") || null,
    recurrence: RECURRENCE.includes(recurrenceRaw) ? recurrenceRaw : null,
    reminder_minutes: reminder ? Number(reminder) : null,
    notes: String(formData.get("notes") || "").trim() || null,
  };
}

export async function addTask(formData: FormData) {
  const { supabase, user } = await requireUser();
  const fields = taskFieldsFrom(formData);
  if (!fields.title) throw new Error("Enter a task title.");
  await supabase.from("tasks").insert({ user_id: user.id, ...fields });
  revalidateTasks();
}

export async function updateTask(id: string, formData: FormData) {
  const { supabase } = await requireUser();
  const fields = taskFieldsFrom(formData);
  if (!fields.title) throw new Error("Enter a task title.");
  await supabase.from("tasks").update(fields).eq("id", id);
  revalidateTasks();
}

function advanceDate(dateISO: string, recurrence: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  if (recurrence === "daily") base.setUTCDate(base.getUTCDate() + 1);
  else if (recurrence === "weekly") base.setUTCDate(base.getUTCDate() + 7);
  else base.setUTCMonth(base.getUTCMonth() + 1);
  return base.toISOString().slice(0, 10);
}

// Set a task's status. Completing a recurring task also spawns its next
// occurrence (a fresh pending copy advanced by the recurrence).
export async function setTaskStatus(id: string, status: string) {
  const { supabase, user } = await requireUser();
  const completing = status === "completed";
  const { data: task } = await supabase
    .from("tasks")
    .select(
      "title,description,category,priority,due_date,due_time,recurrence,reminder_minutes,notes",
    )
    .eq("id", id)
    .single();

  await supabase
    .from("tasks")
    .update({
      status,
      completed_at: completing ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (completing && task?.recurrence && task.due_date) {
    await supabase.from("tasks").insert({
      user_id: user.id,
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      due_date: advanceDate(task.due_date, task.recurrence),
      due_time: task.due_time,
      recurrence: task.recurrence,
      reminder_minutes: task.reminder_minutes,
      notes: task.notes,
      status: "pending",
    });
  }
  revalidateTasks();
}

// Kept for the simple checkbox on dashboard/planner lists.
export async function toggleTask(id: string, done: boolean) {
  await setTaskStatus(id, done ? "completed" : "pending");
}

function revalidateTasks() {
  revalidatePath("/dashboard");
  revalidatePath("/planner");
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

// ---- Debts -----------------------------------------------------------

export async function addDebt(formData: FormData) {
  const { supabase, user } = await requireUser();
  const creditor = String(formData.get("creditor") || "").trim();
  if (!creditor) throw new Error("Enter who you owe.");
  const amount = Number(formData.get("amount"));
  if (!amount || amount <= 0) throw new Error("Enter a valid amount.");
  const amount_paid = Number(formData.get("amount_paid")) || 0;
  const month = String(formData.get("month") || "").trim() || new Date().toISOString().slice(0, 7);
  const due_on = String(formData.get("due_on") || "");
  const notes = String(formData.get("notes") || "") || null;
  await supabase.from("debts").insert({
    user_id: user.id,
    creditor,
    amount,
    amount_paid: Math.min(amount_paid, amount),
    month,
    due_on: due_on || null,
    notes,
  });
  revalidatePath("/debts");
  revalidatePath("/dashboard");
}

export async function logDebtPayment(id: string, amount: number) {
  const { supabase } = await requireUser();
  if (!amount || amount <= 0) throw new Error("Enter a valid amount.");
  // RLS scopes the select to the caller's own row.
  const { data: debt } = await supabase
    .from("debts")
    .select("amount,amount_paid")
    .eq("id", id)
    .single();
  if (!debt) throw new Error("Debt not found.");
  const paid = Math.min(Number(debt.amount_paid) + amount, Number(debt.amount));
  await supabase.from("debts").update({ amount_paid: paid }).eq("id", id);
  revalidatePath("/debts");
  revalidatePath("/dashboard");
}

export async function markDebtPaid(id: string) {
  const { supabase } = await requireUser();
  const { data: debt } = await supabase
    .from("debts")
    .select("amount")
    .eq("id", id)
    .single();
  if (!debt) throw new Error("Debt not found.");
  await supabase.from("debts").update({ amount_paid: Number(debt.amount) }).eq("id", id);
  revalidatePath("/debts");
  revalidatePath("/dashboard");
}

export async function deleteDebt(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("debts").delete().eq("id", id);
  revalidatePath("/debts");
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

// Save several parsed actions at once (the assistant can log multiple items
// from one sentence). Best-effort: skips any that error so the rest still save.
export async function saveAssistantActions(actions: AssistantAction[]) {
  let saved = 0;
  for (const a of actions) {
    try {
      await saveAssistantAction(a);
      saved++;
    } catch {
      /* skip the ones with nothing to save */
    }
  }
  if (saved === 0) throw new Error("Nothing to save for this request.");
  return saved;
}

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

// ---- Reminders (one-off or recurring) ----

export async function addReminder(formData: FormData) {
  const { supabase, user } = await requireUser();
  const title = String(formData.get("title") || "").trim();
  if (!title) throw new Error("Enter a reminder.");
  const at = String(formData.get("remind_at") || "");
  if (!at) throw new Error("Pick a date and time.");
  const recurringRaw = String(formData.get("recurring") || "");
  const recurring = ["daily", "weekly", "monthly"].includes(recurringRaw)
    ? recurringRaw
    : null;
  await supabase.from("reminders").insert({
    user_id: user.id,
    title,
    remind_at: new Date(at).toISOString(),
    recurring,
  });
  revalidatePath("/reminders");
  revalidatePath("/dashboard");
}

export async function deleteReminder(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("reminders").delete().eq("id", id);
  revalidatePath("/reminders");
  revalidatePath("/dashboard");
}

// ---- Rules-based alerts ----

export async function addAlertRule(formData: FormData) {
  const { supabase, user } = await requireUser();
  const type = String(formData.get("type") || "");
  const threshold = Number(formData.get("threshold"));
  if (!threshold || threshold <= 0) throw new Error("Enter a valid amount.");

  if (type === "spend_threshold") {
    const windowRaw = String(formData.get("window") || "week");
    const time_window = ["day", "week", "month"].includes(windowRaw) ? windowRaw : "week";
    const category = String(formData.get("category") || "").trim() || null;
    await supabase.from("alert_rules").insert({
      user_id: user.id,
      type,
      category,
      time_window,
      threshold,
    });
  } else if (type === "balance_below") {
    await supabase.from("alert_rules").insert({
      user_id: user.id,
      type,
      threshold,
    });
  } else {
    throw new Error("Unknown rule type.");
  }
  revalidatePath("/reminders");
}

export async function deleteAlertRule(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("alert_rules").delete().eq("id", id);
  revalidatePath("/reminders");
}

// ---- Linked bank accounts (Mono) ----

export async function unlinkAccount(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("linked_accounts").delete().eq("id", id);
  revalidatePath("/accounts");
}

// ---- Recurring rules (auto-logged transactions like rent/salary) ----

export async function addRecurringRule(formData: FormData) {
  const { supabase, user } = await requireUser();
  const kind = formData.get("kind") === "income" ? "income" : "expense";
  const amount = Number(formData.get("amount"));
  if (!amount || amount <= 0) throw new Error("Enter a valid amount.");
  const category = String(formData.get("category") || "Other").trim() || "Other";
  const freqRaw = String(formData.get("frequency") || "monthly");
  const frequency = ["daily", "weekly", "monthly"].includes(freqRaw)
    ? freqRaw
    : "monthly";
  const next_run =
    String(formData.get("next_run") || "") ||
    new Date().toISOString().slice(0, 10);
  await supabase.from("recurring_rules").insert({
    user_id: user.id,
    kind,
    amount,
    category,
    frequency,
    next_run,
  });
  revalidatePath("/dashboard");
}

export async function deleteRecurringRule(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("recurring_rules").delete().eq("id", id);
  revalidatePath("/dashboard");
}

// ---- Edit / delete (RLS scopes every mutation to the caller's own rows) ----

function revalidateAll() {
  revalidatePath("/dashboard");
  revalidatePath("/history");
  revalidatePath("/income");
}

export async function deleteExpense(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("expenses").delete().eq("id", id);
  revalidateAll();
}

export async function deleteIncome(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("income").delete().eq("id", id);
  revalidateAll();
}

export async function deleteTask(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("tasks").delete().eq("id", id);
  revalidateAll();
}

export async function deleteBudget(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("budgets").delete().eq("id", id);
  revalidateAll();
}

export async function deleteSavingsGoal(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("savings_goals").delete().eq("id", id);
  revalidateAll();
}

export async function updateExpense(
  id: string,
  data: { amount: number; category: string; description: string | null; occurred_on: string },
) {
  const { supabase } = await requireUser();
  if (!data.amount || data.amount <= 0) throw new Error("Enter a valid amount.");
  await supabase
    .from("expenses")
    .update({
      amount: data.amount,
      category: data.category.trim() || "Other",
      description: data.description?.trim() || null,
      occurred_on: data.occurred_on,
    })
    .eq("id", id);
  revalidateAll();
}

export async function updateIncome(
  id: string,
  data: {
    amount: number;
    source_name: string;
    description: string | null;
    occurred_on: string;
    category?: string | null;
    account?: string | null;
    notes?: string | null;
  },
) {
  const { supabase } = await requireUser();
  if (!data.amount || data.amount <= 0) throw new Error("Enter a valid amount.");
  await supabase
    .from("income")
    .update({
      amount: data.amount,
      source_name: data.source_name.trim() || "Other",
      description: data.description?.trim() || null,
      occurred_on: data.occurred_on,
      category: data.category?.trim() || null,
      account: data.account?.trim() || null,
      notes: data.notes?.trim() || null,
    })
    .eq("id", id);
  revalidateAll();
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
