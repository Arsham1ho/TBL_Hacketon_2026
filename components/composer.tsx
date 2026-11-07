"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

// The sample is only a placeholder. It is never submitted.
export function DescriptionComposer(p: {
  question: string;
  sample: string;
  sendLabel: string;
  text: string;
  disabled: boolean;
  onChange: (text: string) => void;
  onSend: () => void;
}) {
  const { text, sample } = p;
  const [focused, setFocused] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const ready = Boolean(text.trim()) && !p.disabled;

  // Starts as one line and grows with the text, up to about six lines.
  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 168)}px`;
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
          className="min-w-0 flex-1 resize-none self-center bg-transparent py-2 text-base leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          type="submit"
          aria-label={p.sendLabel}
          title={p.sendLabel}
          disabled={!ready}
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full transition-all duration-200",
            ready ? "scale-100 bg-foreground text-background hover:opacity-90" : "scale-95 bg-muted text-muted-foreground",
          )}
        >
          <ArrowUp className="size-5" strokeWidth={2.5} aria-hidden />
        </button>
      </div>
    </form>
  );
}
