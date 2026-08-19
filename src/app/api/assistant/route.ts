import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/components/Naira";

// DeepSeek is OpenAI-compatible. Model options: "deepseek-chat" or "deepseek-reasoner".
const MODEL = "deepseek-chat";

const SYSTEM = `You turn a user's message into one or MORE structured actions for a personal finance & task assistant.
Return ONLY a JSON object — no markdown, no commentary — of this shape:
{ "actions": [ ACTION, ... ] }
Each ACTION uses exactly this shape:
{
  "intent": "expense" | "income" | "task" | "reminder" | "query" | "budget" | "goal" | "unknown",
  "amount": number | null,
  "category": string | null,
  "title": string | null,
  "description": string | null,
  "due_date": string | null,
  "period": "today" | "this_week" | "last_week" | "this_month" | "last_month" | null,
  "query_metric": "spend" | "income" | "budget_status" | "balance" | "summary_today" | null,
  "confidence": number
}
Rules:
- Usually "actions" has ONE item. If the message clearly states MULTIPLE separate
  entries ("I spent 2,000 on lunch and 500 on transport"), return one action per
  item.
- Never invent an amount. Only fill "amount" if the user stated one.
- "8,500 naira" or "₦8,500" means amount = 8500.
- Questions about their own data ("how much did I spend on food?") => intent "query"
  (return just that one query action).
- For expenses/income, put the category or source in "category".
- intent "budget": set a monthly spending limit for a category (e.g. "set a 50,000
  budget for food"): category in "category", limit in "amount".
- intent "goal": create a savings goal (e.g. "save 200,000 for a laptop"): name in
  "title", target in "amount".
- For a "query", set "period" to the timeframe named: today, this_week, last_week,
  this_month (default), last_month. Set "query_metric":
  - "income" for money received/earned;
  - "budget_status" for "how am I doing on my <category> budget" (category in "category");
  - "balance" for "what's my balance" / net position;
  - "summary_today" for "summarise today" / "how's my day";
  - otherwise "spend". Name a category in "category" when given; else null.
- If a date is mentioned, "due_date" is ISO yyyy-mm-dd; otherwise null.
- If unsure, use intent "unknown".`;

type Period =
  | "today"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month";

type Action = {
  intent: string;
  amount?: number | null;
  category?: string | null;
  title?: string | null;
  description?: string | null;
  due_date?: string | null;
  period?: Period | null;
  query_metric?:
    | "spend"
    | "income"
    | "budget_status"
    | "balance"
    | "summary_today"
    | null;
  confidence?: number;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) =>
  new Date(d.getTime() + n * 86_400_000);

// Monday-based start of the week containing `d` (UTC).
function startOfWeek(d: Date) {
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const sinceMonday = (day + 6) % 7;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - sinceMonday),
  );
}

// Resolve a period into [start, next) date strings (against occurred_on) + label.
function periodBounds(period: Period | null | undefined) {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const today = new Date(Date.UTC(y, m, now.getUTCDate()));

  switch (period) {
    case "today":
      return { start: iso(today), next: iso(addDays(today, 1)), label: "today" };
    case "this_week": {
      const s = startOfWeek(now);
      return { start: iso(s), next: iso(addDays(s, 7)), label: "this week" };
    }
    case "last_week": {
      const s = addDays(startOfWeek(now), -7);
      return { start: iso(s), next: iso(addDays(s, 7)), label: "last week" };
    }
    case "last_month":
      return {
        start: iso(new Date(Date.UTC(y, m - 1, 1))),
        next: iso(new Date(Date.UTC(y, m, 1))),
        label: "last month",
      };
    case "this_month":
    default:
      return {
        start: iso(new Date(Date.UTC(y, m, 1))),
        next: iso(new Date(Date.UTC(y, m + 1, 1))),
        label: "this month",
      };
  }
}

function sum(rows: Array<{ amount: number | string | null }> | null) {
  return (rows ?? []).reduce((t, r) => t + (Number(r.amount) || 0), 0);
}

// Answer a "query" intent with a real figure from the user's own rows. RLS on the
// authenticated (anon-key) server client scopes every read to the signed-in user,
// so we never touch other people's data and never fabricate a number.
async function answerQuery(action: Action): Promise<{ text: string; amount: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { text: "Please sign in to ask about your data.", amount: 0 };
  }

  const category = action.category?.trim();

  // "What's my balance?" — all income minus all expenses.
  if (action.query_metric === "balance") {
    const [{ data: incAll }, { data: expAll }] = await Promise.all([
      supabase.from("income").select("amount"),
      supabase.from("expenses").select("amount"),
    ]);
    const balance = sum(incAll) - sum(expAll);
    return {
      text: `Your balance is ${naira(balance)} (all income minus all expenses).`,
      amount: balance,
    };
  }

  // "Summarise today."
  if (action.query_metric === "summary_today") {
    const today = iso(new Date());
    const [{ data: expT }, { data: incT }, { data: tasksT }] = await Promise.all([
      supabase.from("expenses").select("amount").eq("occurred_on", today),
      supabase.from("income").select("amount").eq("occurred_on", today),
      supabase
        .from("tasks")
        .select("id")
        .eq("due_date", today)
        .in("status", ["pending", "in_progress"]),
    ]);
    const spent = sum(expT);
    const earned = sum(incT);
    const n = (tasksT ?? []).length;
    return {
      text: `Today: ${n} task${n === 1 ? "" : "s"} due, spent ${naira(spent)}${
        earned > 0 ? `, earned ${naira(earned)}` : ""
      }.`,
      amount: spent,
    };
  }

  // "How am I doing on my <category> budget?" — always the current month, since
  // budgets are monthly.
  if (action.query_metric === "budget_status") {
    if (!category) {
      return {
        text: "Which category's budget do you mean? e.g. “how am I doing on my food budget?”",
        amount: 0,
      };
    }
    const { start, next } = periodBounds("this_month");
    const [{ data: budgetRow }, { data: spendRows }] = await Promise.all([
      supabase
        .from("budgets")
        .select("monthly_limit")
        .ilike("category", category)
        .maybeSingle(),
      supabase
        .from("expenses")
        .select("amount")
        .ilike("category", category)
        .gte("occurred_on", start)
        .lt("occurred_on", next),
    ]);
    const spent = sum(spendRows);
    if (!budgetRow) {
      return {
        text: `You haven't set a ${category} budget yet. You've spent ${naira(spent)} on it this month.`,
        amount: spent,
      };
    }
    const limit = Number(budgetRow.monthly_limit) || 0;
    const remaining = limit - spent;
    const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    return {
      text:
        remaining < 0
          ? `You're over your ${category} budget: ${naira(spent)} of ${naira(limit)} (${pct}%), ${naira(-remaining)} over.`
          : `You've spent ${naira(spent)} of your ${naira(limit)} ${category} budget (${pct}%), ${naira(remaining)} left.`,
      amount: spent,
    };
  }

  const { start, next, label } = periodBounds(action.period);

  if (action.query_metric === "income") {
    const { data } = await supabase
      .from("income")
      .select("amount")
      .gte("occurred_on", start)
      .lt("occurred_on", next);
    const total = sum(data);
    return { text: `You earned ${naira(total)} ${label}.`, amount: total };
  }

  // Default to spend (covers "how much did I spend…" with or without a category).
  let q = supabase
    .from("expenses")
    .select("amount")
    .gte("occurred_on", start)
    .lt("occurred_on", next);
  if (category) q = q.ilike("category", category);
  const { data } = await q;
  const total = sum(data);

  return {
    text: category
      ? `You spent ${naira(total)} on ${category} ${label}.`
      : `You spent ${naira(total)} ${label}.`,
    amount: total,
  };
}

export async function POST(req: Request) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "AI is not configured. Add DEEPSEEK_API_KEY in Vercel." },
      { status: 500 },
    );
  }

  let message = "";
  try {
    message = ((await req.json()) as { message?: string }).message ?? "";
  } catch {
    /* ignore */
  }
  if (!message.trim()) {
    return NextResponse.json({ error: "Empty message." }, { status: 400 });
  }

  try {
    const r = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: message },
        ],
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      return NextResponse.json(
        { error: "The AI request failed.", detail },
        { status: 502 },
      );
    }

    const data = (await r.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? "";

    let parsed: { actions?: Action[]; intent?: string } & Partial<Action>;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { intent: "unknown" };
    }

    // Accept the new { actions: [...] } shape or a legacy single action object.
    let actions: Action[] = Array.isArray(parsed.actions)
      ? parsed.actions
      : parsed.intent
        ? [parsed as Action]
        : [];
    actions = actions.filter((a) => a && a.intent);
    if (actions.length === 0) actions = [{ intent: "unknown" }];

    // A data question is answered directly (take the first query action).
    const query = actions.find((a) => a.intent === "query");
    if (query) {
      const answer = await answerQuery(query);
      return NextResponse.json({ answer });
    }

    return NextResponse.json({ actions });
  } catch (e) {
    return NextResponse.json(
      { error: "Unexpected error.", detail: String(e) },
      { status: 500 },
    );
  }
}
