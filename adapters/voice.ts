import OpenAI from "openai";
import type { Language } from "../engine/types";

// Speech to text on OpenAI. Text to speech on ElevenLabs when its key is set, for a more
// natural voice, otherwise on OpenAI. Gemini's OpenAI-compatible endpoint has no audio routes.

// A key pasted into a hosting dashboard often keeps stray quotes or whitespace, which the
// provider then rejects. Clean them off.
const clean = (value: string | undefined) => value?.trim().replace(/^["']|["']$/g, "").trim() || undefined;
const openAiKey = () => clean(process.env.OPENAI_API_KEY) || clean(process.env.open_ai_api_key);
const elevenLabsKey = () => clean(process.env.ELEVENLABS_API_KEY);

export const sttAvailable = () => Boolean(openAiKey());
export const ttsAvailable = () => Boolean(elevenLabsKey() || openAiKey());

let client: OpenAI | null = null;
export const voiceClient = () => (client ??= new OpenAI({ apiKey: openAiKey(), maxRetries: 1 }));

export const STT_MODEL = () => process.env.STT_MODEL || "gpt-4o-mini-transcribe";

// ---------------------------------------------------------------- text to speech

const TONE: Record<Language, string> = {
  en: "Speak in English",
  fi: "Speak in Finnish with natural Finnish pronunciation",
  sv: "Speak in Finland Swedish with natural pronunciation",
};

// Multilingual v2 is ElevenLabs' most natural model and speaks Finnish and Swedish.
// Flash v2.5 (eleven_flash_v2_5) is faster if latency matters more than quality.
const ELEVEN_MODEL = () => process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
// "Sarah", a calm and reassuring premade voice. Any voice from your ElevenLabs library works.
const ELEVEN_VOICE = () => process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";

async function elevenLabs(text: string, language: Language): Promise<ArrayBuffer> {
  const model = ELEVEN_MODEL();
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE()}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": elevenLabsKey()!, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: model,
      // Only the v2.5 models accept a fixed language; v2 reads it from the text.
      ...(/v2_5/.test(model) ? { language_code: language } : {}),
      // Steady and clear rather than expressive, and a touch slower: the listener may be stressed.
      voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0, use_speaker_boost: true, speed: 0.95 },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return response.arrayBuffer();
}

async function openAi(text: string, language: Language): Promise<ArrayBuffer> {
  const speech = await voiceClient().audio.speech.create({
    model: process.env.TTS_MODEL || "gpt-4o-mini-tts",
    voice: process.env.TTS_VOICE || "coral",
    input: text,
    response_format: "mp3",
    instructions: `${TONE[language]}. Calm, warm and clear, like a reassuring security advisor helping someone who may be stressed. Not too fast.`,
  });
  return speech.arrayBuffer();
}

// ElevenLabs first; if it fails (quota, network), OpenAI says it instead, so the voice never stops.
export async function synthesize(text: string, language: Language): Promise<ArrayBuffer> {
  if (elevenLabsKey()) {
    try {
      return await elevenLabs(text, language);
    } catch (error) {
      console.warn("[voice] ElevenLabs failed, using OpenAI:", (error as Error).message);
      if (!openAiKey()) throw error;
    }
  }
  return openAi(text, language);
}

export const ttsProvider = () => (elevenLabsKey() ? "elevenlabs" : openAiKey() ? "openai" : null);
