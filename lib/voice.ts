// Voice for SafeStep, ported from the LiveAgents voice guide.
//
//   Mic listens on the device and decides for itself when somebody has started and
//   stopped speaking, then hands over that one utterance as a 16 kHz WAV to be
//   transcribed. Nothing is sent while nobody is talking.
//
//   Speaker reads text a sentence at a time, in a cloud voice, or the device's own
//   voice when the cloud one is unavailable. Talking over it stops it.

const RATE = 16_000;
// Audio kept from just before speech was detected, so the first syllable is not lost.
const PRE_ROLL_S = 0.35;
// How long a pause ends an utterance.
const END_SILENCE_S = 0.8;
// Shorter than this is a cough, not a sentence.
const MIN_SPEECH_S = 0.45;
// Longest single utterance before it is sent anyway.
const MAX_UTTERANCE_S = 25;

type AudioContextClass = typeof AudioContext;
const audioContextClass = (): AudioContextClass =>
  window.AudioContext || (window as unknown as { webkitAudioContext: AudioContextClass }).webkitAudioContext;

// One shared output context, so the press that opens voice mode can unlock it.
let sharedOutput: AudioContext | null = null;
const output = () => (sharedOutput ??= new (audioContextClass())());

// Call inside the tap that starts a conversation: browsers only play audio begun from one.
export function unlockAudio() {
  try {
    const context = output();
    void context.resume();
    const source = context.createBufferSource();
    source.buffer = context.createBuffer(1, 1, 22050);
    source.connect(context.destination);
    source.start(0);
  } catch {
    // The device voice still works.
  }
  if ("speechSynthesis" in window) {
    const silent = new SpeechSynthesisUtterance(" ");
    silent.volume = 0;
    window.speechSynthesis.speak(silent);
  }
}

// ------------------------------------------------------------------ the mic

type MicEvents = {
  onLevel?: (level: number) => void;
  onSpeechStart?: () => void;
  onUtterance: (wav: Blob, seconds: number) => void;
};

export class Mic {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private muted = false;
  private ring: Float32Array[] = [];
  private ringLength = 0;
  private recording: Float32Array[] = [];
  private recordingLength = 0;
  private speaking = false;
  private silence = 0;
  private voiced = 0;
  // The room's own noise, learnt while nobody is talking.
  private floor = 0.008;
  private rate = 48_000;

  constructor(private events: MicEvents) {}

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    this.context = new (audioContextClass())();
    await this.context.resume();
    this.rate = this.context.sampleRate;
    this.source = this.context.createMediaStreamSource(this.stream);
    this.node = this.context.createScriptProcessor(4096, 1, 1);
    this.node.onaudioprocess = (event) => this.frame(event.inputBuffer.getChannelData(0));
    this.source.connect(this.node);
    this.node.connect(this.context.destination);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) this.reset();
  }

  stop() {
    try {
      this.node?.disconnect();
      this.source?.disconnect();
      this.stream?.getTracks().forEach((track) => track.stop());
      void this.context?.close();
    } catch {
      // Already gone.
    }
    this.context = null;
  }

  private reset() {
    this.speaking = false;
    this.recording = [];
    this.recordingLength = 0;
    this.silence = 0;
    this.voiced = 0;
  }

  private frame(input: Float32Array) {
    const buffer = new Float32Array(input);
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
    const rms = Math.sqrt(sum / buffer.length);
    const duration = buffer.length / this.rate;
    this.events.onLevel?.(this.muted ? 0 : Math.min(1, rms * 12));
    if (this.muted) return;

    if (!this.speaking) this.floor = this.floor * 0.97 + Math.min(rms, 0.05) * 0.03;
    const loud = rms > Math.max(0.012, this.floor * 3);

    this.ring.push(buffer);
    this.ringLength += duration;
    while (this.ringLength > PRE_ROLL_S && this.ring.length > 1) this.ringLength -= this.ring.shift()!.length / this.rate;

    if (!this.speaking) {
      this.voiced = loud ? this.voiced + duration : 0;
      if (this.voiced >= 0.12) {
        this.speaking = true;
        this.recording = [...this.ring];
        this.recordingLength = this.ringLength;
        this.silence = 0;
        this.events.onSpeechStart?.();
      }
      return;
    }

    this.recording.push(buffer);
    this.recordingLength += duration;
    this.silence = loud ? 0 : this.silence + duration;
    if (this.silence >= END_SILENCE_S || this.recordingLength >= MAX_UTTERANCE_S) {
      const spoken = this.recordingLength - this.silence;
      const chunks = this.recording;
      const total = this.recordingLength;
      this.reset();
      if (spoken >= MIN_SPEECH_S) this.events.onUtterance(toWav(chunks, this.rate), total);
    }
  }
}

// Mono 16-bit PCM at 16 kHz, averaged down from the device's own rate.
function toWav(chunks: Float32Array[], rate: number): Blob {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const step = rate / RATE;
  const count = Math.floor(total / step);
  const pcm = new Int16Array(count);
  const all = new Float32Array(total);
  let at = 0;
  for (const chunk of chunks) {
    all.set(chunk, at);
    at += chunk.length;
  }
  for (let i = 0; i < count; i++) {
    const from = Math.floor(i * step);
    const to = Math.min(total, Math.floor((i + 1) * step));
    let sum = 0;
    for (let j = from; j < to; j++) sum += all[j];
    const value = Math.max(-1, Math.min(1, sum / Math.max(1, to - from)));
    pcm[i] = value < 0 ? value * 32768 : value * 32767;
  }
  const out = new ArrayBuffer(44 + pcm.byteLength);
  const view = new DataView(out);
  const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  new Int16Array(out, 44).set(pcm);
  return new Blob([out], { type: "audio/wav" });
}

// -------------------------------------------------------------- the speaker

export class Speaker {
  private pending = "";
  private chain: Promise<void> = Promise.resolve();
  private generation = 0;
  private aborts = new Set<AbortController>();
  private source: AudioBufferSourceNode | null = null;
  private active = 0;
  private busy = false;
  // The device voice's language tag, such as fi-FI.
  lang = "";
  cloud: ((text: string, signal: AbortSignal) => Promise<ArrayBuffer | null>) | null = null;
  onSpeaking?: (speaking: boolean) => void;
  onLevel?: (level: number) => void;

  // More text. Whole sentences are spoken as soon as they are complete.
  push(text: string) {
    this.pending += text;
    const parts = this.pending.split(/(?<=[.!?…])\s+/);
    this.pending = parts.pop() ?? "";
    for (const part of parts) this.enqueue(part);
  }

  end() {
    if (this.pending.trim()) this.enqueue(this.pending);
    this.pending = "";
  }

  // Stop talking now: the person has started to speak.
  cancel() {
    this.generation++;
    this.pending = "";
    for (const abort of this.aborts) abort.abort();
    this.aborts.clear();
    try {
      this.source?.stop();
    } catch {
      // Already stopped.
    }
    this.source = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    this.chain = Promise.resolve();
    this.active = 0;
    this.onLevel?.(0);
    this.setBusy(false);
  }

  private enqueue(sentence: string) {
    const text = sentence.replace(/[*_#`>[\]]/g, "").trim();
    if (!text) return;
    const generation = this.generation;
    this.active++;
    this.setBusy(true);
    // Fetched at once, played in order: the next sentence downloads while this one plays.
    const audio = this.fetchAudio(text);
    this.chain = this.chain
      .then(async () => {
        if (generation !== this.generation) return;
        const buffer = await audio;
        if (generation !== this.generation) return;
        if (buffer) await this.play(buffer, generation);
        else await this.speakDevice(text, generation);
      })
      .finally(() => {
        if (generation !== this.generation) return;
        this.active = Math.max(0, this.active - 1);
        if (this.active === 0) this.setBusy(false);
      });
  }

  private async fetchAudio(text: string): Promise<AudioBuffer | null> {
    if (!this.cloud) return null;
    const abort = new AbortController();
    this.aborts.add(abort);
    try {
      const raw = await this.cloud(text, abort.signal);
      return raw ? await output().decodeAudioData(raw) : null;
    } catch {
      return null;
    } finally {
      this.aborts.delete(abort);
    }
  }

  private play(buffer: AudioBuffer, generation: number) {
    return new Promise<void>((done) => {
      if (generation !== this.generation) return done();
      const context = output();
      const source = context.createBufferSource();
      source.buffer = buffer;
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyser.connect(context.destination);
      const data = new Uint8Array(analyser.fftSize);
      let frame = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const value of data) peak = Math.max(peak, Math.abs(value - 128));
        this.onLevel?.(Math.min(1, peak / 64));
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      source.onended = () => {
        cancelAnimationFrame(frame);
        this.onLevel?.(0);
        if (this.source === source) this.source = null;
        done();
      };
      this.source = source;
      source.start();
    });
  }

  private speakDevice(text: string, generation: number) {
    return new Promise<void>((done) => {
      if (!("speechSynthesis" in window) || generation !== this.generation) return done();
      const utterance = new SpeechSynthesisUtterance(text);
      if (this.lang) {
        utterance.lang = this.lang;
        const voice = deviceVoice(this.lang);
        if (voice) utterance.voice = voice;
      }
      utterance.rate = 1.03;
      // The device voice has no level to measure, so the orb gets a gentle beat per word.
      utterance.onboundary = () => this.onLevel?.(0.5);
      utterance.onend = () => done();
      utterance.onerror = () => done();
      window.speechSynthesis.speak(utterance);
    });
  }

  private setBusy(busy: boolean) {
    if (this.busy === busy) return;
    this.busy = busy;
    this.onSpeaking?.(busy);
  }
}

// The device's best voice for a language: a natural one if it has one.
function deviceVoice(tag: string) {
  const all = window.speechSynthesis.getVoices();
  const base = tag.toLowerCase().split("-")[0];
  const same = all.filter((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith(base));
  return (
    same.find((voice) => /natural|enhanced|premium|neural/i.test(voice.name)) ??
    same.find((voice) => voice.lang.toLowerCase() === tag.toLowerCase()) ??
    same[0] ??
    null
  );
}

// ------------------------------------------------------------------ the api

export type VoiceSupport = { stt: boolean; tts: boolean };

export const voiceApi = {
  async support(): Promise<VoiceSupport> {
    try {
      const response = await fetch("/api/voice");
      return response.ok ? await response.json() : { stt: false, tts: false };
    } catch {
      return { stt: false, tts: false };
    }
  },
  async transcribe(wav: Blob, language: string): Promise<string> {
    const response = await fetch(`/api/voice/stt${language ? `?lang=${language}` : ""}`, {
      method: "POST",
      headers: { "content-type": "audio/wav" },
      body: wav,
    });
    if (!response.ok) throw new Error(`Transcription failed: ${response.status}`);
    return ((await response.json()).text ?? "").trim();
  },
  async speak(text: string, language: string, signal: AbortSignal): Promise<ArrayBuffer | null> {
    const response = await fetch("/api/voice/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, lang: language }),
      signal,
    });
    return response.ok ? response.arrayBuffer() : null;
  },
};
