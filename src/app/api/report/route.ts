import { NextResponse } from "next/server";

// Turns a report's REAL computed figures into a short narrative + recommendations.
// The numbers are computed server-side from the user's data and passed in; the
// model only phrases them — it is told never to invent figures.
const MODEL = "deepseek-chat";

const SYSTEM = `You are a concise Nigerian personal-finance analyst. You are given a JSON
summary of a user's REAL figures for one period. Write:
1) "summary": a 2–4 sentence plain-English overview of how the period went.
2) "recommendations": 3–5 short, specific, actionable tips tailored to these numbers.
Rules:
- Use ONLY the numbers in the JSON. NEVER invent or estimate figures.
- Currency is Naira, written like ₦12,500.
- Be encouraging but honest; if they overspent or saved nothing, say so kindly.
- Return ONLY JSON: { "summary": string, "recommendations": string[] }.`;

export async function POST(req: Request) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "AI is not configured. Add DEEPSEEK_API_KEY in Vercel." },
      { status: 500 },
    );
  }

  let summary: unknown;
  try {
    summary = (await req.json()) as unknown;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  try {
    const r = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify(summary) },
        ],
      }),
    });
    if (!r.ok) {
      return NextResponse.json({ error: "The AI request failed." }, { status: 502 });
    }
    const data = (await r.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    let out: { summary?: string; recommendations?: string[] } = {};
    try {
      out = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    } catch {
      /* ignore */
    }
    return NextResponse.json({
      summary: out.summary ?? "",
      recommendations: Array.isArray(out.recommendations) ? out.recommendations : [],
    });
  } catch (e) {
    return NextResponse.json({ error: "Unexpected error.", detail: String(e) }, { status: 500 });
  }
}
