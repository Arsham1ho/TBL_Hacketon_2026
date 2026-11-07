"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { unlockAudio } from "@/lib/voice";
import { SiriOrb } from "./siri-orb";

// The sample is only a placeholder. It is never submitted.
export function DescriptionComposer(p: {
  question: string;
  sample: string;
  sendLabel: string;
  text: string;
  disabled: boolean;
  onChange: (text: string) => void;
  onSend: () => void;
  // Shows the voice orb, which opens voice mode.
  onVoice?: () => void;
  voiceLabel?: string;
}) {
  const { text, sample } = p;
  const [focused, setFocused] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const ready = Boolean(text.trim()) && !p.disabled;
  // With voice on offer, an empty field shows the orb in place of the send button.
  const voice = Boolean(p.onVoice) && !text.trim();

  // Starts as one line and grows with the text, up to about six lines. An empty field is
  // always one line: browsers count a wrapped placeholder in scrollHeight, which made it tall.
  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;
    const fit = () => {
      element.style.height = "40px";
      if (text) element.style.height = `${Math.min(Math.max(element.scrollHeight, 40), 168)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [text]);

  return (
    <form
      className="pt-2 pb-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (text.trim()) p.onSend();
      }}
    >
      <div
        className={cn(
          "flex items-end gap-2 rounded-[28px] border bg-card py-1.5 pr-1.5 pl-4 shadow-sm transition-[border-color,box-shadow]",
          focused ? "border-foreground/40 shadow-md ring-4 ring-foreground/5" : "border-border-strong",
        )}
      >
        <label className="sr-only" htmlFor="description">
          {p.question || sample}
        </label>
        <textarea
          ref={field}
          id="description"
          rows={1}
          maxLength={10000}
          value={text}
          onChange={(event) => p.onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }}
          placeholder={p.question ? (focused ? p.question : sample) : sample}
          className="block h-10 min-w-0 flex-1 resize-none self-end overflow-y-auto bg-transparent px-1 py-2 text-base leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {/* One button: the voice orb while the field is empty, the send arrow once there is text. */}
        <div className="relative size-10 shrink-0 self-end">
          {p.onVoice && (
            <button
              type="button"
              aria-label={p.voiceLabel}
              aria-hidden={!voice}
              tabIndex={voice ? 0 : -1}
              onClick={() => {
                // Speaking during the tap lets iOS play the voice that follows.
                unlockAudio();
                p.onVoice?.();
              }}
              className={cn(
                "absolute inset-0 flex items-center justify-center rounded-full shadow-[0_0_0_1px_rgb(139_92_246/0.18),0_2px_12px_rgb(99_102_241/0.45)] transition-[opacity,transform] duration-200 hover:scale-110 active:scale-90",
                voice ? "scale-100 opacity-100" : "pointer-events-none scale-50 opacity-0",
              )}
            >
              <SiriOrb mode="idle" size={0.47} className="size-10 rounded-full" />
            </button>
          )}
          <button
            type="submit"
            aria-label={p.sendLabel}
            aria-hidden={voice}
            tabIndex={voice ? -1 : 0}
            title={p.sendLabel}
            disabled={!ready}
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-full transition-all duration-200",
              voice ? "pointer-events-none scale-50 opacity-0" : "scale-100 opacity-100",
              ready ? "bg-foreground text-background hover:opacity-90" : "bg-muted text-muted-foreground",
            )}
          >
            <ArrowUp className="size-5" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </div>
    </form>
  );
}
