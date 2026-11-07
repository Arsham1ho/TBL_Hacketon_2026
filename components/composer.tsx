"use client";

import { useState } from "react";
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
  const [focused, setFocused] = useState(false);

  return (
    <form
      className="pt-2 pb-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (text.trim()) p.onSend();
      }}
    >
      <div className="flex items-end gap-2 rounded-xl border border-border-strong bg-card p-1.5 focus-within:border-primary">
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
          placeholder={p.question ? (focused ? p.question : sample) : sample}
          className="max-h-40 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2.5 py-2 text-base leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <Btn
          type="submit"
          aria-label={p.sendLabel}
          title={p.sendLabel}
          disabled={p.disabled || !text.trim()}
          className="size-11 min-h-11 shrink-0 px-0 py-0"
          variant="primary"
        >
          <ArrowUp className="size-5" aria-hidden />
        </Btn>
      </div>
    </form>
  );
}
