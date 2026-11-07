import { NextResponse } from "next/server";
import { z } from "zod";
import { Language } from "../../../../engine/types";
import { synthesize, ttsAvailable } from "../../../../adapters/voice";

// One sentence of SafeStep's approved text in, speech out.
const Body = z.strictObject({ text: z.string().trim().min(1).max(800), lang: Language });

export async function POST(request: Request) {
  if (!ttsAvailable()) return NextResponse.json({ error: "Voice is not configured" }, { status: 503 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  try {
    const audio = await synthesize(parsed.data.text, parsed.data.lang);
    return new Response(audio, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Speech failed" }, { status: 502 });
  }
}
