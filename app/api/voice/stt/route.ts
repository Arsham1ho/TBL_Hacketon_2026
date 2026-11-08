import { NextResponse } from "next/server";
import { toFile } from "openai";
import { STT_MODEL, sttAvailable, voiceClient } from "../../../../adapters/voice";

// One spoken utterance in, its words out. The audio is not kept. The words then go through
// the session API like typed text, where the Input Guard masks codes and passwords.
const LANGUAGES = new Set(["fi", "en", "sv"]);
// 25 seconds of 16 kHz mono 16-bit audio is about 800 kB.
const MAX_BYTES = 1_200_000;

// Finnish, English and Swedish are all written in Latin script. Text in another script, such as
// Chinese from a burst of noise, is a transcription of nothing the user said, so it is dropped.
const OTHER_SCRIPT = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;
const PROMPT = "The speaker talks Finnish, English or Swedish to a security helpline about a possible scam, hacked account or suspicious message.";
// On silence the model can return the prompt itself, which must not be taken as the user's words.
const simplify = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const echoesPrompt = (text: string) => simplify(text).length > 12 && simplify(PROMPT).includes(simplify(text));
function plausible(text: string) {
  const trimmed = text.trim();
  return trimmed.length > 0 && !OTHER_SCRIPT.test(trimmed) && !echoesPrompt(trimmed);
}

export async function POST(request: Request) {
  if (!sttAvailable()) return NextResponse.json({ error: "Voice is not configured" }, { status: 503 });
  const audio = await request.arrayBuffer();
  if (audio.byteLength < 100 || audio.byteLength > MAX_BYTES) return NextResponse.json({ error: "Bad audio" }, { status: 400 });
  const language = new URL(request.url).searchParams.get("lang") ?? "";
  try {
    const result = await voiceClient().audio.transcriptions.create({
      file: await toFile(Buffer.from(audio), "speech.wav", { type: "audio/wav" }),
      model: STT_MODEL(),
      ...(LANGUAGES.has(language) ? { language } : {}),
      // Without a hint, noise or a short sound can come back as words in a language nobody spoke.
      prompt: PROMPT,
    });
    return NextResponse.json({ text: plausible(result.text) ? result.text : "" });
  } catch (error) {
    // Logged without the audio or the key, so a rejected key or a quota problem shows in the host's logs.
    const { status, code, message } = error as { status?: number; code?: string; message?: string };
    console.error("[voice] transcription failed:", status ?? "", code ?? "", (message ?? "").slice(0, 200));
    return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
  }
}
