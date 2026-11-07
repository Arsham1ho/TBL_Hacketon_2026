"use client";

import { useState, useRef, useEffect } from "react";
import type { ApiResponse, Screen } from "@/engine/screens";

type Item =
  | { kind: "user"; text: string }
  | { kind: "qa"; question: string; answer: "yes" | "no" | "unsure" }
  | { kind: "stop"; message: string };

export function LegacyChatApp() {
  const [input, setInput] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen | null>(null);
  const [apiState, setApiState] = useState<ApiResponse["state"] | null>(null);
  const [secretWarning, setSecretWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [items, screen, busy]);

  async function post(body: object) {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("failed");
      const data: ApiResponse = await res.json();
      setSessionId(data.sessionId);
      setScreen(data.screen);
      setApiState(data.state);
      if (data.secretWarning) setSecretWarning(data.secretWarning);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  function start() {
    const text = input.trim();
    if (!text || busy) return;
    setItems([{ kind: "user", text }]);
    setInput("");
    void post({ kind: "start", audience: "consumer", language: "auto", message: text });
  }

  function answer(value: "yes" | "no" | "unsure") {
    if (screen?.type !== "flip" || busy) return;
    const question = screen.question;
    setItems(prev => [...prev, { kind: "qa", question, answer: value }]);
    void post({ kind: "answer", sessionId, topic: screen.topic, answer: value });
  }

  function continueAfterStop() {
    if (screen?.type !== "stop" || busy) return;
    setItems(prev => [...prev, { kind: "stop", message: screen.message }]);
    void post({ kind: "continue", sessionId });
  }

  async function reset() {
    if (sessionId) {
      await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "end", sessionId }),
      }).catch(() => null);
    }
    setSessionId(null);
    setScreen(null);
    setApiState(null);
    setItems([]);
    setInput("");
    setFailed(false);
    setSecretWarning(null);
  }

  const started = items.length > 0;

  return (
    <div className="flex flex-col h-screen bg-white" style={{ maxWidth: 480, margin: "0 auto" }}>

      {/* ── Header ── */}
      <header className="flex-shrink-0 text-center pt-10 pb-4">
        <span className="text-lg font-semibold tracking-tight text-gray-900">SafeStep</span>
      </header>

      {/* ── Conversation feed ── */}
      <div ref={feedRef} className="flex-1 overflow-y-auto px-5 flex flex-col gap-3 pb-4">

        {items.map((item, i) => (
          <div key={i}>
            {item.kind === "user" && (
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <p className="text-sm text-gray-800 leading-relaxed">{item.text}</p>
              </div>
            )}
            {item.kind === "qa" && (
              <div className="bg-gray-100 rounded-2xl px-4 py-3 space-y-1">
                <p className="text-xs text-gray-400 leading-snug">{item.question}</p>
                <p className="text-sm font-medium text-gray-900">
                  {item.answer === "yes" ? "Yes" : item.answer === "no" ? "No" : "Not sure"}
                </p>
              </div>
            )}
            {item.kind === "stop" && (
              <div className="bg-red-50 rounded-2xl px-4 py-3">
                <p className="text-sm text-red-700 font-medium">{item.message}</p>
              </div>
            )}
          </div>
        ))}

        {secretWarning && (
          <div className="bg-amber-50 rounded-2xl px-4 py-3">
            <p className="text-xs text-amber-700">{secretWarning}</p>
          </div>
        )}

        {busy && (
          <div className="flex gap-1 px-1 py-2">
            {[0, 150, 300].map(delay => (
              <span
                key={delay}
                className="w-2 h-2 rounded-full bg-gray-300 animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom action area ── */}
      <div className="flex-shrink-0 px-5 pb-10 pt-4 border-t border-gray-100">

        {failed && (
          <p className="text-xs text-red-500 text-center mb-3">
            Something went wrong. Please try again.
          </p>
        )}

        {/* Initial input */}
        {!started && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {[
                "I opened a link in a parcel text and I'm not sure if it was a scam.",
                "Someone called me from my bank and asked for a code from my text message.",
                "My phone number is being transferred to another operator. I didn't request this.",
              ].map(example => (
                <button
                  key={example}
                  onClick={() => { setInput(example); }}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors text-left"
                >
                  {example.length > 48 ? example.slice(0, 48) + "…" : example}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-full px-5 py-3 focus-within:border-gray-400 transition-colors">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && start()}
                placeholder="Describe what happened…"
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
                autoFocus
              />
              <button
                onClick={start}
                disabled={!input.trim() || busy}
                aria-label="Send"
                className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-25 hover:bg-gray-700 transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M1.5 6.5h10M7.5 2.5l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Stop screen */}
        {!busy && screen?.type === "stop" && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-red-600 px-5 py-4 text-white">
              <p className="font-semibold text-base leading-snug">{screen.message}</p>
              {screen.actions.map(a => (
                <p key={a} className="mt-1 text-sm opacity-80">{a}</p>
              ))}
            </div>
            <button
              onClick={continueAfterStop}
              className="w-full rounded-full border border-gray-200 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {/* Decision Flip */}
        {!busy && screen?.type === "flip" && (
          <div className="space-y-4">
            <div className="text-center space-y-1 px-2">
              <p className="text-xs text-gray-400">{screen.why}</p>
              <p className="text-base font-semibold text-gray-900 leading-snug">{screen.question}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => answer("no")}
                className="flex-1 rounded-full border border-gray-200 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                No
              </button>
              <button
                onClick={() => answer("yes")}
                className="flex-1 rounded-full bg-gray-900 py-3 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
              >
                Yes
              </button>
            </div>
            <button
              onClick={() => answer("unsure")}
              className="w-full rounded-full border border-gray-200 py-3 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Not sure
            </button>
          </div>
        )}

        {/* Result */}
        {screen?.type === "result" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gray-50 border border-gray-100 px-5 py-4 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                {screen.statusLabel}
              </p>
              {screen.branches ? (
                screen.branches.map(b => (
                  <div key={b.condition}>
                    <p className="text-xs font-medium text-gray-500 mb-1">{b.condition}</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      {b.steps.map(s => <li key={s} className="text-sm text-gray-800">{s}</li>)}
                    </ol>
                  </div>
                ))
              ) : (
                <ol className="list-decimal pl-4 space-y-1">
                  {screen.steps.map(s => <li key={s} className="text-sm text-gray-800">{s}</li>)}
                </ol>
              )}
              <div className="pt-1 border-t border-gray-200 space-y-1">
                <p className="text-xs text-gray-400 leading-relaxed">{screen.reason}</p>
                <p className="text-xs text-gray-300">{screen.confidence}</p>
              </div>
            </div>
            <button
              onClick={reset}
              className="w-full rounded-full border border-gray-200 py-3 text-sm text-gray-400 hover:bg-gray-50 transition-colors"
            >
              Start again
            </button>
          </div>
        )}

        {/* Fallback */}
        {screen?.type === "fallback" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gray-50 border border-gray-100 px-5 py-4">
              <p className="text-sm font-medium text-gray-800 leading-relaxed">{screen.message}</p>
              <ul className="mt-2 space-y-1 list-disc pl-4">
                {screen.actions.map(a => <li key={a} className="text-sm text-gray-600">{a}</li>)}
              </ul>
            </div>
            <button onClick={reset} className="w-full rounded-full border border-gray-200 py-3 text-sm text-gray-400 hover:bg-gray-50 transition-colors">
              Start again
            </button>
          </div>
        )}

        {/* Signal Unlock */}
        {!busy && screen?.type === "unlock" && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-blue-50 border border-blue-100 px-5 py-4 space-y-1">
              <p className="text-sm font-medium text-gray-900">{screen.what}</p>
              <p className="text-xs text-gray-500">{screen.why}</p>
              <p className="text-xs text-gray-400">{screen.limit}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void post({ kind: "consent", sessionId, signal: screen.signal, granted: false })}
                className="flex-1 rounded-full border border-gray-200 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                No thanks
              </button>
              <button
                onClick={() => void post({ kind: "consent", sessionId, signal: screen.signal, granted: true })}
                className="flex-1 rounded-full bg-blue-600 py-3 text-sm text-white hover:bg-blue-700 transition-colors"
              >
                Allow once
              </button>
            </div>
          </div>
        )}

        {/* Rescue step */}
        {!busy && screen?.type === "rescue" && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-gray-50 border border-gray-100 px-5 py-4">
              <p className="text-xs text-gray-400 mb-1">Step {screen.position} of {screen.total}</p>
              <p className="text-sm font-medium text-gray-900 leading-snug">{screen.step.detail}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void post({ kind: "rescue", sessionId, stepId: screen.step.id, outcome: "not_possible" })}
                className="flex-1 rounded-full border border-gray-200 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Could not do this
              </button>
              <button
                onClick={() => void post({ kind: "rescue", sessionId, stepId: screen.step.id, outcome: "done" })}
                className="flex-1 rounded-full bg-gray-900 py-3 text-sm text-white hover:bg-gray-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Handoff */}
        {!busy && screen?.type === "handoff" && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-gray-50 border border-gray-100 px-5 py-4 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                Hand off to {screen.destination.replace(/_/g, " ")}
              </p>
              <ul className="space-y-1">
                {screen.summary.map(line => (
                  <li key={line} className="text-xs text-gray-700 leading-relaxed">{line}</li>
                ))}
              </ul>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void post({ kind: "handoff", sessionId, approved: false })}
                className="flex-1 rounded-full border border-gray-200 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Decline
              </button>
              <button
                onClick={() => void post({ kind: "handoff", sessionId, approved: true })}
                className="flex-1 rounded-full bg-gray-900 py-3 text-sm text-white hover:bg-gray-700 transition-colors"
              >
                Approve
              </button>
            </div>
          </div>
        )}

        {/* Session ended */}
        {screen?.type === "end" && (
          <div className="space-y-4">
            <p className="text-sm text-center text-gray-400">{screen.message}</p>
            <button onClick={reset} className="w-full rounded-full border border-gray-200 py-3 text-sm text-gray-400 hover:bg-gray-50 transition-colors">
              Start again
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
