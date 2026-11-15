import { z } from "zod";

const Body = z.object({ to: z.string().regex(/^\+?[1-9]\d{7,14}$/, "Enter the number with country code"), text: z.string().min(1).max(1000) });
const configured = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

/** Lets the UI show the "Send to my phone" button only when the env vars are present. */
export async function GET() {
  return Response.json({ enabled: configured() });
}

/** Optional: sends the summary through the WhatsApp Cloud API test number. Free-form text only delivers inside the 24-hour window. */
export async function POST(req: Request) {
  if (!configured()) return Response.json({ error: "WhatsApp is not configured" }, { status: 501 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const res = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to: parsed.data.to.replace(/^\+/, ""), type: "text", text: { preview_url: true, body: parsed.data.text } }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    return Response.json({ error: err.error?.message ?? `WhatsApp API ${res.status}` }, { status: 502 });
  }
  return Response.json({ ok: true });
}
