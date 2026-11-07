"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Btn } from "./ui";

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
  const [shownSample, setShownSample] = useState("");
  const [focused, setFocused] = useState(false);
  const [bottom, setBottom] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => setBottom(viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0);
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    if (text || focused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShownSample(sample);
      return;
    }
    let index = 0;
    let timer: ReturnType<typeof setTimeout>;
    const type = () => {
      index += 1;
      setShownSample(sample.slice(0, index));
      if (index < sample.length) {
        timer = setTimeout(type, 55);
      } else {
        timer = setTimeout(() => {
          index = 0;
          setShownSample("");
          timer = setTimeout(type, 600);
        }, 2600);
      }
    };
    timer = setTimeout(type, 500);
    return () => clearTimeout(timer);
  }, [sample, text, focused]);

  return (
    <form
      style={{ bottom }}
      className="fixed inset-x-0 z-40 px-4 pt-3 pb-[max(1.75rem,env(safe-area-inset-bottom))]"
      onSubmit={(event) => {
        event.preventDefault();
        if (text.trim()) p.onSend();
      }}
    >
      <div className="mx-auto flex w-full max-w-[560px] items-end gap-2 rounded-3xl border border-border bg-card p-2 focus-within:border-primary">
        <label className="sr-only" htmlFor="description">
          {p.question}
        </label>
        <textarea
          id="description"
          rows={2}
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
          placeholder={focused ? p.question : shownSample}
          className="max-h-40 min-h-14 min-w-0 flex-1 resize-none bg-transparent px-3 py-2 text-base leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <Btn
          type="submit"
          aria-label={p.sendLabel}
          title={p.sendLabel}
          disabled={p.disabled || !text.trim()}
          className="mb-1 size-11 min-h-11 w-11 shrink-0 px-0 py-0"
        >
          <ArrowUp className="size-5" aria-hidden />
        </Btn>
      </div>
    </form>
  );
}
