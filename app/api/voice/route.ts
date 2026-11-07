import { NextResponse } from "next/server";
import { sttAvailable, ttsAvailable, ttsProvider } from "../../../adapters/voice";

// Tells the voice UI what is on. Without it, the browser's own speech is used.
export function GET() {
  return NextResponse.json({ stt: sttAvailable(), tts: ttsAvailable(), voice: ttsProvider() });
}
