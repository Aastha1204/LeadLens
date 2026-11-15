import { z } from "zod";

const Body = z.object({
  figures: z.record(z.string(), z.object({ display: z.string(), unit: z.string() })),
  labels: z.record(z.string(), z.string()),
});
const SERVICES = ["review_automation", "whatsapp_followup", "meta_ads", "ai_call_answering", "online_booking", "content_updates"] as const;
const Out = z.object({
  headline: z.string(),
  recommendations: z.array(z.object({ title: z.string(), body: z.string(), evidence: z.array(z.string()), service: z.enum(SERVICES) })).length(3),
});

const SYSTEM = `You write the commentary for a monthly lead report for a small Indian business owner. You receive METRICS_JSON. Use only figures that appear in METRICS_JSON, copied exactly from their display field. Never calculate, round or estimate new figures. Write every number as digits. Formal, plain English; at most 2 sentences per recommendation. Return strict JSON: { "headline": string, "recommendations": [ { "title": string, "body": string, "evidence": string[], "service": "review_automation" | "whatsapp_followup" | "meta_ads" | "ai_call_answering" | "online_booking" | "content_updates" } ] } with exactly 3 recommendations. evidence lists the metric keys used.`;

/** Lets the client skip the LLM call (and avoid a failing request) when no key is configured. */
export async function GET() {
  return Response.json({ enabled: Boolean(process.env.LLM_API_KEY) });
}

/** Optional. Works with any OpenAI-compatible chat-completions endpoint (LLM_BASE_URL, LLM_MODEL, LLM_API_KEY). */
export async function POST(req: Request) {
  const key = process.env.LLM_API_KEY;
  if (!key) return Response.json({ error: "LLM not configured" }, { status: 501 });
  const raw = await req.text();
  if (raw.length > 200_000) return Response.json({ error: "Payload too large" }, { status: 413 });
  const body = Body.safeParse(JSON.parse(raw || "{}"));
  if (!body.success) return Response.json({ error: "Invalid body" }, { status: 400 });
  try {
    const res = await fetch(`${process.env.LLM_BASE_URL ?? "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.LLM_MODEL ?? "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: `METRICS_JSON:\n${JSON.stringify(body.data)}` }],
      }),
    });
    if (!res.ok) return Response.json({ error: `Upstream ${res.status}` }, { status: 502 });
    const content = (await res.json()).choices?.[0]?.message?.content ?? "";
    const parsed = Out.safeParse(JSON.parse(content));
    if (!parsed.success) return Response.json({ error: "Model returned an unexpected shape" }, { status: 502 });
    return Response.json({ data: parsed.data });
  } catch {
    return Response.json({ error: "LLM request failed" }, { status: 502 });
  }
}
