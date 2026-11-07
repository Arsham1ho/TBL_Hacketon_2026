"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string; icon?: ReactNode };

// SafeStep's own dropdown, in place of the browser's: the same rounded field as the rest of
// the app, with an icon or logo beside each choice. It works like a native select from the
// keyboard: arrows move, Enter or Space picks, Escape closes, and typing a letter jumps to it.
export function SelectMenu({
  id,
  label,
  value,
  options,
  placeholder,
  placeholderIcon,
  onChange,
}: {
  id?: string;
  label: string;
  value?: string;
  options: SelectOption[];
  placeholder: string;
  placeholderIcon?: ReactNode;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  // Opens below the field, or above it when there isn't room. Fixed, so a scrolling sheet can't clip it.
  const measure = () => {
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const up = below < 240 && above > below;
    setPlace({
      left: rect.left,
      width: rect.width,
      ...(up ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
      maxHeight: Math.min(340, up ? above : below),
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const index = options.findIndex((option) => option.value === value);
    setActive(index >= 0 ? index : 0);
    const close = (event: Event) => {
      const target = event.target as Node;
      if (!list.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function pick(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    button.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const last = options.length - 1;
    const move = (index: number) => {
      event.preventDefault();
      if (!open) setOpen(true);
      setActive(Math.max(0, Math.min(last, index)));
    };
    switch (event.key) {
      case "ArrowDown":
        return move(open ? active + 1 : active);
      case "ArrowUp":
        return move(open ? active - 1 : active);
      case "Home":
        return move(0);
      case "End":
        return move(last);
      case "Enter":
      case " ":
        event.preventDefault();
        return open ? pick(active) : setOpen(true);
      case "Escape":
        if (open) {
          // Closes only the menu, not the sheet around it.
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }
        return;
      case "Tab":
        return setOpen(false);
      default:
        if (event.key.length === 1) {
          const letter = event.key.toLowerCase();
          const start = open ? active + 1 : 0;
          const order = [...options.slice(start), ...options.slice(0, start)];
          const found = order.find((option) => option.label.toLowerCase().startsWith(letter));
          if (found) {
            setOpen(true);
            setActive(options.indexOf(found));
          }
        }
    }
  }

  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onKeyDown}
        className={cn(
          "flex h-11 w-full items-center gap-2.5 rounded-full border bg-card pr-3 pl-1.5 text-left text-sm text-foreground transition-[border-color,box-shadow]",
          open ? "border-foreground/40 shadow-md ring-4 ring-foreground/5" : "border-border-strong hover:border-foreground/30",
        )}
      >
        <span className={cn("flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full", !selected?.icon && "bg-accent text-muted-foreground")}>
          {selected?.icon ?? placeholderIcon}
        </span>
        <span className={cn("min-w-0 flex-1 truncate font-medium", !selected && "font-normal text-muted-foreground")}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && place && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label={label}
          style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight }}
          className="fixed z-[70] grid content-start gap-0.5 overflow-y-auto overscroll-contain rounded-2xl border border-border-strong bg-card p-1.5 text-foreground shadow-2xl motion-safe:animate-[menu-in_.16s_ease-out]"
        >
          {options.map((option, index) => {
            const chosen = option.value === value;
            return (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={chosen}
                onPointerEnter={() => setActive(index)}
                onClick={() => pick(index)}
                className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm", index === active && "bg-accent", chosen && "font-semibold")}
              >
                <span className={cn("flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full", !option.icon && "bg-accent text-muted-foreground")}>
                  {option.icon ?? placeholderIcon}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {chosen && <Check className="size-4 shrink-0" aria-hidden />}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// A provider's official logo, framed the same way for every brand.
export const ProviderLogo = ({ src, small }: { src: string; small?: boolean }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt="" width={32} height={32} className={cn("shrink-0 rounded-full border border-border bg-white object-contain", small ? "size-6" : "size-8")} />
);
