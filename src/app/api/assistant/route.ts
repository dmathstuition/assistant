import { NextResponse } from "next/server";

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
  "confidence": number
}
Rules:
- Never invent an amount. Only fill "amount" if the user stated one.
- "8,500 naira" or "₦8,500" means amount = 8500.
- Questions about their own data ("how much did I spend on food?") => intent "query".
- For expenses/income, put the category or source in "category".
- If a date is mentioned, "due_date" is ISO yyyy-mm-dd; otherwise null.
- If unsure, use intent "unknown".`;

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

    let action: unknown;
    try {
      action = JSON.parse(text);
    } catch {
      action = { intent: "unknown", confidence: 0 };
    }
    return NextResponse.json({ action });
  } catch (e) {
    return NextResponse.json(
      { error: "Unexpected error.", detail: String(e) },
      { status: 500 },
    );
  }
}
