"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
  await supabase.from("expenses").insert({
    user_id: user.id,
    amount,
    category: String(formData.get("category") || "Other"),
    description: String(formData.get("description") || "") || null,
    source: "manual",
  });
  revalidatePath("/dashboard");
}

export async function addIncome(formData: FormData) {
  const { supabase, user } = await requireUser();
  const amount = Number(formData.get("amount"));
  if (!amount || amount <= 0) throw new Error("Enter a valid amount.");
  await supabase.from("income").insert({
    user_id: user.id,
    amount,
    source_name: String(formData.get("source_name") || "Other"),
    description: String(formData.get("description") || "") || null,
    source: "manual",
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
  } else if (action.intent === "income" && action.amount) {
    await supabase.from("income").insert({
      user_id: user.id,
      amount: action.amount,
      source_name: action.category || "Other",
      description: action.description || null,
      source: "ai",
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
  } else {
    throw new Error("Nothing to save for this request.");
  }
  revalidatePath("/dashboard");
}
