"use client";

import { useState } from "react";

type Answer = "yes" | "no" | "unsure";
type Reply = {
  sessionId: string;
  extractedBy: string;
  notice: string;
  secretWarning: string | null;
  stop: { message: string; actions: string[] } | null;
  flip: { topic: string; question: string; why: string } | null;
  result: {
    status: string;
    statusLabel: string;
    risk: string;
    urgency: string;
    action: string;
    steps: string[];
    branches: { condition: string; steps: string[] }[] | null;
    reason: string;
    confidence: string;
    unknowns: string[];
    destination: string | null;
    externalContacts: string[];
    sources: string[];
    confirmedFacts: { text: string; source: string }[];
  };
  fallback?: { message: string; actions: string[] };
};

const STATUS_STYLE: Record<string, string> = {
  safe: "bg-green-100 text-green-900",
  needs_verification: "bg-amber-100 text-amber-900",
  threat_in_progress: "bg-orange-100 text-orange-900",
  incident_occurred: "bg-red-100 text-red-900",
};

const EXAMPLES = [
  ["Live scam", "Someone from my bank is still on the phone and wants the code from my text message."],
  ["Harmless", "My bank texted that I have a new message. Is this a scam?"],
  ["Decision Flip", "I opened a link in a parcel text and now I think it was a scam."],
  ["Unclear", "help"],
];

export default function Home() {
  const [message, setMessage] = useState("");
  const [incident, setIncident] = useState("");
  const [language, setLanguage] = useState("en");
  const [audience, setAudience] = useState("consumer");
  const [reply, setReply] = useState<Reply | null>(null);
  const [fallback, setFallback] = useState<Reply["fallback"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function send(body: object) {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch("/api/assess", { method: "POST", body: JSON.stringify(body) });
      if (!response.ok) throw new Error("request failed");
      const data = await response.json();
      if (data.fallback) {
        setFallback(data.fallback);
        setReply(null);
      } else {
        setFallback(null);
        setReply(data);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (reply) await fetch(`/api/assess?sessionId=${reply.sessionId}`, { method: "DELETE" });
    setReply(null);
    setFallback(null);
    setMessage("");
    setIncident("");
  }

  const answer = (value: Answer) =>
    reply?.flip && send({ sessionId: reply.sessionId, topic: reply.flip.topic, answer: value });

  return (
    <main className="mx-auto max-w-xl px-4 py-8 text-gray-900">
      <p className="rounded bg-gray-100 px-3 py-2 text-xs text-gray-700">
        Synthetic prototype. Not a live DNA service. This is a temporary test page for Stages 1 and 2.
      </p>
      <h1 className="mt-5 text-2xl font-semibold">SafeStep</h1>

      {!reply && !fallback && (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send({ audience, language, message, ...(incident.trim() ? { incident } : {}) });
          }}
        >
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map(([label, text]) => (
              <button key={label} type="button" onClick={() => setMessage(text)} className="rounded border px-2 py-1 text-sm">
                {label}
              </button>
            ))}
          </div>
          <label className="block text-sm font-medium">
            What happened?
            <textarea required value={message} onChange={(event) => setMessage(event.target.value)} rows={4} className="mt-1 w-full rounded border p-2 font-normal" />
          </label>
          <label className="block text-sm font-medium">
            Message you received (optional)
            <textarea value={incident} onChange={(event) => setIncident(event.target.value)} rows={3} className="mt-1 w-full rounded border p-2 font-normal" />
          </label>
          <div className="flex gap-3">
            <label className="text-sm">
              Reply language{" "}
              <select value={language} onChange={(event) => setLanguage(event.target.value)} className="rounded border p-1">
                <option value="en">English</option>
                <option value="fi">Suomi</option>
                <option value="sv">Svenska</option>
              </select>
            </label>
            <label className="text-sm">
              User{" "}
              <select value={audience} onChange={(event) => setAudience(event.target.value)} className="rounded border p-1">
                <option value="consumer">Consumer</option>
                <option value="small_business">Small business</option>
              </select>
            </label>
          </div>
          <button disabled={busy} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
            {busy ? "Checking…" : "Check this"}
          </button>
        </form>
      )}

      {failed && <p role="alert" className="mt-4 rounded bg-red-100 p-3 text-sm">Something went wrong. Please try again, or talk to a person.</p>}

      {fallback && (
        <section className="mt-4 rounded border p-4">
          <p className="font-medium">{fallback.message}</p>
          <ul className="mt-2 list-disc pl-5 text-sm">{fallback.actions.map((action) => <li key={action}>{action}</li>)}</ul>
          <button onClick={reset} className="mt-3 rounded border px-3 py-1 text-sm">Start again</button>
        </section>
      )}

      {reply && (
        <section className="mt-4 space-y-4">
          {reply.secretWarning && <p className="rounded bg-yellow-100 p-3 text-sm">{reply.secretWarning}</p>}

          {reply.stop && (
            <div role="alert" className="rounded bg-red-700 p-4 text-white">
              <p className="text-lg font-bold">{reply.stop.message}</p>
              <p className="mt-1">{reply.stop.actions[0]}</p>
            </div>
          )}

          <div className="rounded border p-4">
            <span className={`rounded px-2 py-1 text-sm font-medium ${STATUS_STYLE[reply.result.status]}`}>{reply.result.statusLabel}</span>
            {reply.result.branches ? (
              reply.result.branches.map((branch) => (
                <div key={branch.condition} className="mt-3">
                  <p className="font-medium">{branch.condition}</p>
                  <ol className="mt-1 list-decimal space-y-1 pl-5">
                    {branch.steps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                </div>
              ))
            ) : (
              <ol className="mt-3 list-decimal space-y-1 pl-5">
                {reply.result.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
            )}
            <p className="mt-3 text-sm"><strong>Why:</strong> {reply.result.reason}</p>
            <p className="mt-1 text-sm text-gray-600">{reply.result.confidence}</p>
          </div>

          {reply.flip && (
            <div className="rounded border-2 border-black p-4">
              <p className="text-sm text-gray-600">{reply.flip.why}</p>
              <p className="mt-1 text-lg font-medium">{reply.flip.question}</p>
              <div className="mt-3 flex gap-2">
                {(["yes", "no", "unsure"] as const).map((value) => (
                  <button key={value} disabled={busy} onClick={() => answer(value)} className="flex-1 rounded bg-black px-3 py-3 text-white disabled:opacity-50">
                    {value === "unsure" ? "Not sure" : value === "yes" ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <details className="rounded bg-gray-50 p-3 text-sm" open>
            <summary className="cursor-pointer font-medium">How the engine decided</summary>
            <dl className="mt-2 grid grid-cols-2 gap-1">
              <dt>Facts read by</dt><dd>{reply.extractedBy}</dd>
              <dt>Action</dt><dd>{reply.result.action}</dd>
              <dt>Risk / urgency</dt><dd>{reply.result.risk} / {reply.result.urgency}</dd>
              <dt>Handoff (simulated)</dt><dd>{reply.result.destination ?? "none"}</dd>
              <dt>User contacts</dt><dd>{reply.result.externalContacts.join(", ") || "none"}</dd>
              <dt>Still unknown</dt><dd>{reply.result.unknowns.join(", ") || "nothing decisive"}</dd>
            </dl>
            {reply.result.confirmedFacts.length > 0 && (
              <ul className="mt-2 list-disc pl-5">
                {reply.result.confirmedFacts.map((fact) => <li key={fact.text}>{fact.text} ({fact.source})</li>)}
              </ul>
            )}
            <p className="mt-2 text-xs text-gray-600">Synthetic guidance: {reply.result.sources.join(", ")}</p>
          </details>

          <p className="text-xs text-gray-600">{reply.notice}</p>
          <button onClick={reset} className="rounded border px-3 py-1 text-sm">Start again</button>
        </section>
      )}
    </main>
  );
}
