import { NextResponse } from "next/server";

// Current, stable production model. See the current list at:
// https://docs.claude.com/en/docs/about-claude/models
// (Switch to "claude-haiku-4-5" to cut cost for this simple parsing task.)
const MODEL = "claude-sonnet-4-6";

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
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "AI is not configured. Add ANTHROPIC_API_KEY in Vercel." },
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
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: SYSTEM,
        messages: [{ role: "user", content: message }],
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
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");

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
