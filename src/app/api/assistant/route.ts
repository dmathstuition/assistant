import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/components/Naira";

// DeepSeek is OpenAI-compatible. Model options: "deepseek-chat" or "deepseek-reasoner".
const MODEL = "deepseek-chat";

const SYSTEM = `You turn a user's message into ONE structured action for a personal finance & task assistant.
Return ONLY a JSON object — no markdown, no commentary. Use exactly this shape:
{
  "intent": "expense" | "income" | "task" | "reminder" | "query" | "unknown",
  "amount": number | null,
  "category": string | null,
  "title": string | null,
  "description": string | null,
  "due_date": string | null,
  "query_metric": "spend" | "income" | null,
  "confidence": number
}
Rules:
- Never invent an amount. Only fill "amount" if the user stated one.
- "8,500 naira" or "₦8,500" means amount = 8500.
- Questions about their own data ("how much did I spend on food?") => intent "query".
- For expenses/income, put the category or source in "category".
- For a "query", set "query_metric" to "income" when the question is about money
  received/earned/income, otherwise "spend". If the question names a spending
  category (e.g. food, transport), put it in "category"; for a plain total-spend
  or total-income question leave "category" null. "query_metric" is null for every
  non-query intent.
- If a date is mentioned, "due_date" is ISO yyyy-mm-dd; otherwise null.
- If unsure, use intent "unknown".`;

type Action = {
  intent: string;
  amount?: number | null;
  category?: string | null;
  title?: string | null;
  description?: string | null;
  due_date?: string | null;
  query_metric?: "spend" | "income" | null;
  confidence?: number;
};

// The first day of the current month and of next month, as yyyy-mm-dd strings,
// used to bound "this month" against the `occurred_on` date column.
function monthBounds() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString().slice(0, 10), next: next.toISOString().slice(0, 10) };
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

  const { start, next } = monthBounds();

  if (action.query_metric === "income") {
    const { data } = await supabase
      .from("income")
      .select("amount")
      .gte("occurred_on", start)
      .lt("occurred_on", next);
    const total = sum(data);
    return { text: `You've earned ${naira(total)} this month.`, amount: total };
  }

  // Default to spend (covers "how much did I spend…" with or without a category).
  const category = action.category?.trim();
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
      ? `You've spent ${naira(total)} on ${category} this month.`
      : `You've spent ${naira(total)} this month.`,
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

    let action: Action;
    try {
      action = JSON.parse(text) as Action;
    } catch {
      action = { intent: "unknown", confidence: 0 };
    }

    if (action.intent === "query") {
      const answer = await answerQuery(action);
      return NextResponse.json({ action, answer });
    }

    return NextResponse.json({ action });
  } catch (e) {
    return NextResponse.json(
      { error: "Unexpected error.", detail: String(e) },
      { status: 500 },
    );
  }
}
