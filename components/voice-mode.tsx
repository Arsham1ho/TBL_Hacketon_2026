"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { readAnswerOffline } from "@/engine/answer-reader";
import { findUrl } from "@/engine/link-check";
import { maskSecrets } from "@/engine/input-guard";
import type { ApiRequest, ApiResponse, Screen } from "@/engine/screens";
import type { Audience, Language } from "@/engine/types";
import { createClient } from "@/lib/client";
import { translator, type Translate } from "@/lib/ui-text";
import type { ProviderChoice, ProviderKind } from "@/lib/providers";
import { Mic as Microphone, Speaker, voiceApi } from "@/lib/voice";
import { newConversationId, recapItem, recapText, saveConversation, type HistoryItem, type Recap } from "@/lib/history";
import { DescriptionComposer } from "./composer";
import { SiriOrb } from "./siri-orb";
import { screenTurn, type Turn } from "./turns";
import { Btn, SecretNote, StepMark } from "./ui";

// Voice mode: the same session API and the same screens as the chat, spoken aloud.
// The engine still makes every decision. This file only turns speech into the event the
// current screen expects, and turns each screen into words.

type Phase = "idle" | "listening" | "thinking" | "speaking";

const LOCALE: Record<Language, string> = { en: "en-US", fi: "fi-FI", sv: "sv-SE" };

const VOICE_TEXT = {
  en: {
    greeting: "Hi, I'm SafeStep. Tell me what happened, in your own words.",
    tap: "Tap to talk",
    listening: "Listening…",
    thinking: "Thinking…",
    speaking: "Speaking",
    notSupported: "Voice input isn't available in this browser. Type your answer instead.",
    micDenied: "I can't use the microphone. Allow it in your browser, or type instead.",
    didntCatch: "I didn't catch that. Tap and try again.",
    sayYesNo: "Please answer yes or no.",
    sayDone: "Say done when you've finished, or say you can't do it.",
    step: "Step {n} of {total}.",
    unlockAsk: "May I check this? Say yes or no.",
    linkSkip: "Or say skip.",
    shareAsk: "Shall I share this summary with {name}? Say yes or no.",
    stopAsk: "Tell me when you have done this.",
    whatToDo: "What to do now:",
    resultAsk: "You can tap and tell me more if anything changes.",
    error: "Something went wrong on my side. Please try again.",
    type: "Type to SafeStep",
    placeholder: "Type your answer",
    restart: "Start over",
    close: "Close voice mode",
    end: "End",
    mute: "Mute microphone",
    unmute: "Turn microphone on",
    micOff: "Microphone off",
    interrupt: "Talk over me any time to interrupt.",
    cloudPrivacy: "Your voice is turned into text by OpenAI. Codes and passwords are masked before SafeStep reads them.",
    privacy: "Speech is turned into text by your browser's speech service.",
  },
  fi: {
    greeting: "Hei, olen SafeStep. Kerro omin sanoin, mitä tapahtui.",
    tap: "Napauta ja puhu",
    listening: "Kuuntelen…",
    thinking: "Mietin…",
    speaking: "Puhun",
    notSupported: "Puheentunnistus ei toimi tässä selaimessa. Kirjoita vastauksesi.",
    micDenied: "En pääse mikrofoniin. Salli se selaimessa tai kirjoita vastauksesi.",
    didntCatch: "En saanut selvää. Napauta ja yritä uudelleen.",
    sayYesNo: "Vastaa kyllä tai ei.",
    sayDone: "Sano valmis, kun olet tehnyt sen, tai sano, jos et voi.",
    step: "Vaihe {n}/{total}.",
    unlockAsk: "Saanko tarkistaa tämän? Sano kyllä tai ei.",
    linkSkip: "Tai sano ohita.",
    shareAsk: "Jaanko tämän yhteenvedon: {name}? Sano kyllä tai ei.",
    stopAsk: "Kerro, kun olet tehnyt tämän.",
    whatToDo: "Tee nyt näin:",
    resultAsk: "Voit napauttaa ja kertoa lisää, jos jokin muuttuu.",
    error: "Jokin meni pieleen. Yritä uudelleen.",
    type: "Kirjoita SafeStepille",
    placeholder: "Kirjoita vastauksesi",
    restart: "Aloita alusta",
    close: "Sulje puhetila",
    end: "Lopeta",
    mute: "Mykistä mikrofoni",
    unmute: "Laita mikrofoni päälle",
    micOff: "Mikrofoni pois",
    interrupt: "Voit keskeyttää minut puhumalla päälle.",
    cloudPrivacy: "OpenAI muuttaa puheesi tekstiksi. Koodit ja salasanat peitetään ennen kuin SafeStep lukee ne.",
    privacy: "Selaimesi puhepalvelu muuttaa puheen tekstiksi.",
  },
  sv: {
    greeting: "Hej, jag är SafeStep. Berätta med egna ord vad som hände.",
    tap: "Tryck och prata",
    listening: "Lyssnar…",
    thinking: "Tänker…",
    speaking: "Talar",
    notSupported: "Röstinmatning fungerar inte i den här webbläsaren. Skriv ditt svar i stället.",
    micDenied: "Jag kan inte använda mikrofonen. Tillåt den i webbläsaren eller skriv i stället.",
    didntCatch: "Jag uppfattade inte det. Tryck och försök igen.",
    sayYesNo: "Svara ja eller nej.",
    sayDone: "Säg klart när du är färdig, eller säg om du inte kan.",
    step: "Steg {n} av {total}.",
    unlockAsk: "Får jag kontrollera det här? Säg ja eller nej.",
    linkSkip: "Eller säg hoppa över.",
    shareAsk: "Ska jag dela sammanfattningen med {name}? Säg ja eller nej.",
    stopAsk: "Säg till när du har gjort det här.",
    whatToDo: "Gör så här nu:",
    resultAsk: "Du kan trycka och berätta mer om något ändras.",
    error: "Något gick fel hos mig. Försök igen.",
    type: "Skriv till SafeStep",
    placeholder: "Skriv ditt svar",
    restart: "Börja om",
    close: "Stäng röstläget",
    end: "Avsluta",
    mute: "Stäng av mikrofonen",
    unmute: "Slå på mikrofonen",
    micOff: "Mikrofonen av",
    interrupt: "Prata i mun på mig när du vill avbryta.",
    cloudPrivacy: "OpenAI gör om din röst till text. Koder och lösenord maskeras innan SafeStep läser dem.",
    privacy: "Talet görs om till text av webbläsarens taltjänst.",
  },
} satisfies Record<Language, Record<string, string>>;
type VoiceText = (typeof VOICE_TEXT)["en"];

// Spoken words that pick a fixed reply. Checked before the yes/no reader.
const SKIP = /^\s*(skip|ohita|hoppa över|hoppa)\b/iu;
const TALK = /talk to (a |an )?(person|human|someone)|speak (to|with) (a |an )?(person|human|someone)|ihmisen kanssa|puhua ihmiselle|asiakaspalvelijan|prata med (en )?(person|människa)|tala med (en )?(person|människa)/iu;
const CANT = /can'?t|cannot|not possible|unable|won'?t|skip|en voi|en pysty|ei onnistu|ohita|kan inte|går inte|hoppa över/iu;
const DONE = /\b(done|did it|finished|completed|ok|okay)\b|valmis|tehty|hoidettu|klart?\b|gjort|färdig/iu;

// Screens where SafeStep is waiting for an answer, so the mic opens on its own after speaking.
const AWAITS: Screen["type"][] = ["stop", "flip", "ask", "describe", "evidence", "unlock", "rescue", "handoff"];

const sentence = (text: string) => {
  const trimmed = text.trim();
  return !trimmed || /[.!?…:]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};
const say = (...parts: (string | undefined | false)[]) => parts.filter(Boolean).map((part) => sentence(part as string)).join(" ");
const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));

export function speechFor(screen: Screen, t: Translate, v: VoiceText): string {
  switch (screen.type) {
    case "stop":
      return say(screen.message, ...screen.actions, v.stopAsk);
    case "flip":
      return say(...(screen.context ?? []), screen.question);
    case "ask":
      return say(screen.question);
    case "describe":
      return say(screen.message, screen.hint);
    case "evidence":
      return say(screen.question, v.linkSkip);
    case "unlock":
      return say(`${t("unlockTitle")} ${screen.what}`, screen.why, screen.limit, v.unlockAsk);
    case "rescue":
      return say(fill(v.step, { n: screen.position, total: screen.total }), screen.step.title, screen.step.detail, v.sayDone);
    case "handoff":
      return say(...screen.summary, fill(v.shareAsk, { name: t(screen.route) }));
    case "result": {
      const toDo = screen.steps.filter((step) => !screen.completed.includes(step));
      return say(screen.statusLabel, screen.reason, toDo.length > 0 && v.whatToDo, ...toDo, v.resultAsk);
    }
    case "fallback":
      return say(screen.message, ...screen.actions);
    case "end":
      return say(screen.message);
  }
}

// Turns what the user said into the one event the current screen accepts.
// "retry" means the words didn't answer the question, so SafeStep asks again.
export function requestFor(screen: Screen | null, text: string, language: Language): ApiRequest | "retry" | "start" {
  if (!screen || screen.type === "end" || screen.type === "fallback") return "start";
  const answer = () => readAnswerOffline(text, language);
  switch (screen.type) {
    case "stop":
      return TALK.test(text) ? { kind: "talk_to_person" } : { kind: "continue" };
    case "flip":
      return { kind: "answer_text", topic: screen.topic, text };
    case "ask":
      return { kind: "ai_answer", id: screen.id, text };
    case "describe":
      return { kind: "add_details", text };
    // Spoken words are what the message or caller said, and a spoken web address is checked.
    // "Skip" moves on without anything.
    case "evidence":
      if (SKIP.test(text)) return { kind: "skip_evidence" };
      return { kind: "evidence", value: screen.field === "link" ? (findUrl(text) ?? text) : text };
    case "unlock": {
      const read = answer();
      return read === "unsure" ? "retry" : { kind: "consent", signal: screen.signal, granted: read === "yes" };
    }
    case "rescue": {
      if (TALK.test(text)) return { kind: "talk_to_person" };
      const read = answer();
      if (CANT.test(text) || read === "no") return { kind: "rescue", stepId: screen.step.id, outcome: "not_possible" };
      if (DONE.test(text) || read === "yes") return { kind: "rescue", stepId: screen.step.id, outcome: "done" };
      return "retry";
    }
    case "handoff": {
      const read = answer();
      return read === "unsure" ? "retry" : { kind: "handoff", approved: read === "yes" };
    }
    case "result":
      return TALK.test(text) ? { kind: "talk_to_person" } : { kind: "add_details", text };
  }
}

// The Web Speech API isn't in every TypeScript DOM library, so only what's used is typed.
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
const recognitionClass = (): (new () => Recognition) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => Recognition) | null;
};


// How the user is heard: hands-free through the cloud, or tap-to-talk through the browser.
type Input = "starting" | "hands_free" | "browser" | "typing";
type Part = "why" | "details";

const normalise = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
const UNDERSTOOD = /understand|got it|next|continue|ymmärrän|selvä|seuraava|jatka|förstår|nästa|fortsätt/iu;

export function VoiceMode(p: { audience: Audience; choice: Language | "auto"; fallbackLanguage: Language; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [input, setInput] = useState<Input>("starting");
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [heard, setHeard] = useState("");
  const [notice, setNotice] = useState("");
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  // The same local state the chat keeps for a result shown card by card.
  const [stage, setStage] = useState(0);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<Part[]>([]);
  const [caseClosed, setCaseClosed] = useState(false);
  const [providers, setProviders] = useState<ProviderChoice>({});
  // The conversation as the chat would have recorded it, saved to the browser's history.
  const [log, setLog] = useState<HistoryItem[]>([]);
  const conversation = useRef<{ id: string; startedAt: number } | null>(null);
  const lastStatus = useRef<string | null>(null);
  // What SafeStep asked, then what the user answered, in the chat's own words.
  const record = (recap: Recap | undefined, answer: string) =>
    setLog((items) => [...items, ...(recap ? [recapItem(recap)] : []), { from: "user" as const, text: answer }]);

  const client = useRef(createClient());
  const screenRef = useRef<Screen | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const inputRef = useRef<Input>("starting");
  const mutedRef = useRef(false);
  const busy = useRef(false);
  // Set when voice mode closes. Anything still on its way (a transcription, a reply,
  // a sentence being fetched) checks it and stops, so nothing speaks after End.
  const closed = useRef(false);
  const level = useRef(0);
  const mic = useRef<Microphone | null>(null);
  const speaker = useRef<Speaker | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const speakToken = useRef(0);
  const finishSpeaking = useRef<{ token: number; resolve: (finished: boolean) => void } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const language: Language = response?.language ?? (p.choice === "auto" ? p.fallbackLanguage : p.choice);
  const languageRef = useRef(language);
  languageRef.current = language;
  const t = translator(language);
  const v = VOICE_TEXT[language];

  const setPhaseBoth = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };
  const setInputBoth = (next: Input) => {
    inputRef.current = next;
    setInput(next);
  };
  // What the orb does when nothing is being said: listening if the mic is open.
  const resting = (): Phase => (inputRef.current === "hands_free" && !mutedRef.current ? "listening" : "idle");

  // The bank and operator the user picked, shared with the chat.
  useEffect(() => {
    try {
      setProviders(JSON.parse(localStorage.getItem("safestep-providers") ?? "{}"));
    } catch {}
  }, []);
  function choose(kind: ProviderKind, id: string) {
    const next = { ...providers, [kind]: id };
    setProviders(next);
    try {
      localStorage.setItem("safestep-providers", JSON.stringify(next));
    } catch {}
  }

  // The chat's own actions, so every card and button behaves exactly as in the chat.
  const actions = {
    t,
    business: p.audience !== "consumer",
    reply: (recap: Recap, label: string, request: ApiRequest) => {
      record(recap, label);
      setHeard(label);
      void send(request);
    },
    handoff: (recap: Recap, label: string, approved: boolean) => {
      record(recap, label);
      setHeard(label);
      void send({ kind: "handoff", approved });
    },
    restart: () => void restart(),
    closed: caseClosed,
    close: (recap: Recap, label: string) => {
      record(recap, label);
      setHeard(label);
      setCaseClosed(true);
    },
    stage,
    confirmed,
    advance: (recap: Recap, label: string) => {
      record(recap, label);
      setHeard(label);
      if (label === t("done")) setConfirmed((steps) => [...steps, recapText(recap)]);
      setStage((value) => value + 1);
    },
    revealed,
    reveal: (part: Part) => setRevealed((parts) => [...parts, part]),
    providers,
    choose,
  };
  const turn = response ? screenTurn(response, actions) : null;
  const turnRef = useRef<Turn | null>(null);
  turnRef.current = turn;

  // The handlers the long-lived mic calls always see the latest render.
  const events = useRef({ speechStart: () => {}, utterance: (_wav: Blob) => {} });
  events.current.speechStart = () => {
    if (closed.current || busy.current) return;
    stopSpeaking();
    setNotice("");
    setHeard("");
    setPhaseBoth("listening");
  };
  events.current.utterance = (wav: Blob) => {
    if (closed.current || busy.current) return;
    setPhaseBoth("thinking");
    const spoken = response?.language ?? (p.choice === "auto" ? "" : p.choice);
    voiceApi
      .transcribe(wav, spoken)
      .then((text) => {
        if (closed.current) return;
        if (text) void submitText(text);
        else setPhaseBoth(resting());
      })
      .catch(() => {
        if (closed.current) return;
        setNotice(v.didntCatch);
        setPhaseBoth(resting());
      });
  };

  // Opens the microphone and greets the user. Everything stops when voice mode closes.
  useEffect(() => {
    let cancelled = false;
    closed.current = false;
    const voice = new Speaker();
    speaker.current = voice;
    voice.onLevel = (value) => {
      if (phaseRef.current === "speaking") level.current = value;
    };
    let unmute: ReturnType<typeof setTimeout> | undefined;
    voice.onSpeaking = (on) => {
      clearTimeout(unmute);
      // The mic rests while SafeStep speaks, so its own voice is never taken as an answer,
      // and for a moment after, so the room's echo of the last word isn't either.
      if (on) mic.current?.setMuted(true);
      else unmute = setTimeout(() => mic.current?.setMuted(mutedRef.current), 400);
      if (on) setPhaseBoth("speaking");
      else if (phaseRef.current === "speaking") setPhaseBoth(resting());
      if (!on && finishSpeaking.current) {
        const { token, resolve } = finishSpeaking.current;
        finishSpeaking.current = null;
        resolve(token === speakToken.current);
      }
    };

    void (async () => {
      const support = await voiceApi.support();
      if (cancelled) return;
      if (support.tts) voice.cloud = (text, signal) => voiceApi.speak(text, languageRef.current, signal);
      if (support.stt && typeof navigator.mediaDevices?.getUserMedia === "function") {
        const microphone = new Microphone({
          onLevel: (value) => {
            if (phaseRef.current === "listening") level.current = value;
          },
          onSpeechStart: () => events.current.speechStart(),
          onUtterance: (wav) => events.current.utterance(wav),
        });
        try {
          await microphone.start();
          if (cancelled) return microphone.stop();
          mic.current = microphone;
          setInputBoth("hands_free");
        } catch {
          if (cancelled) return;
          setNotice(VOICE_TEXT[languageRef.current].micDenied);
          setInputBoth("typing");
        }
      } else setInputBoth(recognitionClass() ? "browser" : "typing");
      if (cancelled) return;
      if (inputRef.current === "typing") setTyping(true);
      const finished = await speak(VOICE_TEXT[languageRef.current].greeting);
      if (finished && inputRef.current === "browser") listen();
    })();

    return () => {
      cancelled = true;
      closed.current = true;
      clearTimeout(unmute);
      speakToken.current++;
      voice.cancel();
      voice.cloud = null;
      if (speaker.current === voice) speaker.current = null;
      finishSpeaking.current?.resolve(false);
      finishSpeaking.current = null;
      mic.current?.stop();
      mic.current = null;
      recognition.current?.abort();
      recognition.current = null;
      void client.current.end().catch(() => null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Saved as it goes, so the chat is in History even if voice mode is closed mid-way.
  useEffect(() => {
    if (log.length === 0) return;
    conversation.current ??= { id: newConversationId(), startedAt: Date.now() };
    const first = log.find((item) => item.from === "user" && !item.assessment);
    saveConversation({
      ...conversation.current,
      updatedAt: Date.now(),
      audience: p.audience,
      language,
      title: (first?.text ?? "").slice(0, 120) || t("history"),
      items: log,
      status: response?.state.status,
      statusLabel: response?.state.statusLabel,
      likelyType: response?.state.likelyType,
      voice: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, response]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && p.onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p]);

  // Each new screen, and each new card of a result, is read aloud once.
  useEffect(() => {
    if (!response) return;
    scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
    const screen = response.screen;
    const words = screen.type === "result" ? (turnRef.current?.say ?? "") : speechFor(screen, translator(response.language), VOICE_TEXT[response.language]);
    const warning = stage === 0 && response.secretWarning;
    void speak(warning ? say(warning, words) : words).then((finished) => {
      if (finished && inputRef.current === "browser" && (AWAITS.includes(screen.type) || screen.type === "result")) listen();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response, stage]);

  function stopSpeaking() {
    speakToken.current++;
    speaker.current?.cancel();
  }

  // Speaks the text a sentence at a time. Resolves true only if it was not interrupted.
  function speak(text: string): Promise<boolean> {
    const voice = speaker.current;
    stopSpeaking();
    if (closed.current || !voice) return Promise.resolve(false);
    if (!text.trim()) return Promise.resolve(true);
    const token = speakToken.current;
    voice.lang = LOCALE[languageRef.current];
    return new Promise((resolve) => {
      finishSpeaking.current = { token, resolve };
      voice.push(text);
      voice.end();
    });
  }

  // Tap-to-talk with the browser's own recognition, when the cloud voice is off.
  function listen() {
    const Recognizer = recognitionClass();
    if (closed.current || !Recognizer) return;
    stopSpeaking();
    recognition.current?.abort();
    setNotice("");
    setHeard("");
    const recognizer = new Recognizer();
    recognizer.lang = LOCALE[languageRef.current];
    recognizer.interimResults = true;
    recognizer.continuous = false;
    let transcript = "";
    let failed = false;
    recognizer.onresult = (event) => {
      transcript = Array.from(event.results, (result) => result[0].transcript).join("");
      setHeard(maskSecrets(transcript).text);
      level.current = 0.6;
    };
    recognizer.onerror = (event) => {
      failed = true;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setNotice(v.micDenied);
        setTyping(true);
      } else if (event.error !== "aborted") setNotice(v.didntCatch);
    };
    recognizer.onend = () => {
      if (recognition.current === recognizer) recognition.current = null;
      level.current = 0;
      if (closed.current || phaseRef.current !== "listening") return;
      const text = transcript.trim();
      if (text) void submitText(text);
      else {
        if (!failed) setNotice(v.didntCatch);
        setPhaseBoth("idle");
      }
    };
    recognition.current = recognizer;
    setPhaseBoth("listening");
    try {
      recognizer.start();
    } catch {
      setPhaseBoth("idle");
    }
  }

  // A new screen starts its result from the first card, as in the chat.
  function present(next: ApiResponse) {
    if (closed.current) return;
    screenRef.current = next.screen;
    languageRef.current = next.language;
    const status = next.state?.status;
    if (status && status !== lastStatus.current && (status !== "needs_verification" || lastStatus.current) && next.screen.type !== "result") {
      setLog((items) => [...items, { from: "safestep", text: next.state.statusLabel ?? status, assessment: next.state }]);
    }
    lastStatus.current = status ?? lastStatus.current;
    setStage(0);
    setRevealed([]);
    setConfirmed([]);
    setNotice("");
    setResponse(next);
  }

  async function send(request: ApiRequest) {
    stopSpeaking();
    recognition.current?.abort();
    busy.current = true;
    setPhaseBoth("thinking");
    setNotice("");
    try {
      const next = await client.current.send(request);
      busy.current = false;
      // Closed while waiting: the reply is dropped and the new session cleared on the server.
      if (closed.current) return void client.current.end().catch(() => null);
      present(next);
    } catch {
      busy.current = false;
      if (closed.current) return;
      setPhaseBoth(resting());
      setNotice(v.error);
      await speak(v.error);
    }
  }

  // A spoken answer on a result card picks the same button the user could tap.
  function answerCard(text: string): boolean {
    const replies = turnRef.current?.replies ?? [];
    const said = normalise(text);
    const named = replies.find((reply) => said.includes(normalise(reply.label)));
    if (named) return named.run(), true;
    if (CANT.test(text)) {
      const out = replies.find((reply) => reply.label === t("notPossible") || reply.label === t("skipStep"));
      if (out) return out.run(), true;
    }
    const primary = replies.find((reply) => reply.primary);
    if (primary && (DONE.test(text) || UNDERSTOOD.test(text) || readAnswerOffline(text, languageRef.current) === "yes")) return primary.run(), true;
    return false;
  }

  async function submitText(text: string) {
    if (closed.current) return;
    setHeard(maskSecrets(text).text);
    const screen = screenRef.current;
    if (screen?.type === "result" && !TALK.test(text) && answerCard(text)) return setPhaseBoth(resting());
    const request = requestFor(screen, text, languageRef.current);
    if (request !== "retry") record(request === "start" ? undefined : turnRef.current?.recap, maskSecrets(text).text);
    if (request === "retry") {
      const prompt = screen?.type === "rescue" ? v.sayDone : v.sayYesNo;
      setNotice(prompt);
      const finished = await speak(prompt);
      if (finished && inputRef.current === "browser") listen();
      return;
    }
    await send(
      request === "start"
        ? { kind: "start", audience: p.audience, language: p.choice, fallbackLanguage: p.fallbackLanguage, message: text }
        : request,
    );
  }

  async function restart() {
    stopSpeaking();
    recognition.current?.abort();
    await client.current.end().catch(() => null);
    screenRef.current = null;
    conversation.current = null;
    lastStatus.current = null;
    setLog([]);
    setResponse(null);
    setHeard("");
    setNotice("");
    setCaseClosed(false);
    setPhaseBoth(resting());
    const finished = await speak(VOICE_TEXT[languageRef.current].greeting);
    if (finished && inputRef.current === "browser") listen();
  }

  // The orb: interrupts SafeStep, or (tap-to-talk) starts and stops listening.
  function tapOrb() {
    if (phase === "thinking") return;
    if (phase === "speaking") {
      stopSpeaking();
      if (inputRef.current === "browser") listen();
      return;
    }
    if (input === "browser") {
      if (phase === "listening") recognition.current?.stop();
      else listen();
    }
  }

  const status =
    input === "starting"
      ? v.thinking
      : phase === "listening"
        ? v.listening
        : phase === "thinking"
          ? v.thinking
          : phase === "speaking"
            ? v.speaking
            : input === "browser"
              ? v.tap
              : "";
  const privacy = input === "hands_free" ? v.cloudPrivacy : input === "browser" ? v.privacy : "";
  const replies = turn?.replies ?? [];

  return (
    <div role="dialog" aria-modal="true" aria-label="SafeStep voice" className="voice-mode fixed inset-0 z-[60] flex flex-col overflow-hidden bg-background text-foreground" data-phase={phase}>
      {/* SafeStep's current step, drawn by the chat itself, so it looks and works the same. */}
      <div ref={scroller} className="relative mx-auto grid max-h-[58dvh] w-full max-w-[640px] shrink-0 content-start gap-2.5 overflow-y-auto px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-1 leading-relaxed">
        {response?.secretWarning && stage === 0 && <SecretNote text={response.secretWarning} />}
        {turn ? (
          <div className="grid gap-2.5">{turn.body}</div>
        ) : (
          <section className="voice-card grid gap-2.5 rounded-2xl border border-border-strong bg-card p-4">
            <StepMark className="size-5 text-foreground" />
            <h2 className="text-lg leading-snug font-semibold text-balance">{v.greeting}</h2>
          </section>
        )}
        {replies.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {replies.map((option) => (
              <Btn
                key={option.label}
                variant={option.primary ? "primary" : "plain"}
                disabled={phase === "thinking"}
                onClick={option.run}
                className="min-w-[45%] flex-1 gap-2"
              >
                {option.icon}
                {option.label}
              </Btn>
            ))}
          </div>
        )}
      </div>

      {/* The orb shows who is talking. Tapping it interrupts SafeStep. */}
      <button
        type="button"
        onClick={tapOrb}
        aria-label={phase === "speaking" ? v.speaking : status || v.tap}
        disabled={phase === "thinking" || input === "starting"}
        className="voice-orb-stage relative mx-auto min-h-[110px] w-full max-w-[320px] flex-1 focus:outline-none"
      >
        <SiriOrb mode={phase} level={level} className="absolute inset-0 h-full w-full" />
      </button>

      {/* What the user said, as their chat bubble, and what SafeStep is doing. */}
      <div className="relative mx-auto flex min-h-[4.5rem] w-full max-w-[640px] flex-col items-center gap-2 px-4 text-center" aria-live="polite">
        {heard && <p className="voice-card max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2 leading-relaxed">{heard}</p>}
        {notice && <p className="rounded-full bg-warning-soft px-3 py-1 text-sm font-medium text-warning">{notice}</p>}
        {status && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {phase === "listening" && <span className="size-1.5 animate-pulse rounded-full bg-destructive" aria-hidden />}
            {status}
          </p>
        )}
      </div>

      <div className="relative mx-auto grid w-full max-w-[640px] justify-items-center gap-3 px-4 pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {/* Typing appears only when the microphone can't be used. */}
        {typing && (
          <div className="w-full">
            <DescriptionComposer
              question=""
              sample={v.placeholder}
              sendLabel={t("send")}
              text={draft}
              disabled={phase === "thinking"}
              onChange={setDraft}
              onSend={() => {
                const text = draft.trim();
                if (!text) return;
                setDraft("");
                recognition.current?.abort();
                void submitText(text);
              }}
            />
          </div>
        )}
        <Btn variant="plain" onClick={p.onClose} aria-label={v.close} className="min-h-11 gap-2 rounded-full px-5 text-sm font-semibold">
          <X className="size-4" aria-hidden />
          {v.end}
        </Btn>
        <p className="pb-1 text-center text-[11px] text-muted-foreground">
          {t("prototype")} {privacy}
        </p>
      </div>
    </div>
  );
}
