"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, CircleHelp, EyeOff, Info, OctagonAlert } from "lucide-react";
import type { Status } from "@/engine/types";
import { cn } from "@/lib/utils";

const statusStyle: Record<Status, { className: string; Icon: typeof CheckCircle2 }> = {
  safe: { className: "bg-success text-primary-foreground border-success", Icon: CheckCircle2 },
  needs_verification: { className: "bg-warning-soft text-warning border-warning", Icon: CircleHelp },
  threat_in_progress: { className: "bg-destructive text-primary-foreground border-destructive", Icon: OctagonAlert },
  incident_occurred: { className: "bg-danger-soft text-danger-deep border-danger-deep", Icon: AlertTriangle },
};

export function StatusLabel({ status, label }: { status: Status; label: string }) {
  const { className, Icon } = statusStyle[status];
  return (
    <span className={cn("inline-flex w-fit items-center gap-1.5 self-start rounded-full border-2 px-4 py-1.5 text-base font-bold", className)}>
      <Icon className="size-5" aria-hidden />
      {label}
    </span>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "onDanger" | "onDangerGhost" | "choice";

const variants: Record<Variant, string> = {
  primary: "glass-tint text-primary-foreground hover:brightness-110",
  secondary: "glass text-foreground hover:bg-accent",
  ghost: "text-primary hover:bg-accent underline-offset-4 hover:underline",
  onDanger: "bg-card text-danger-deep hover:bg-danger-soft",
  onDangerGhost: "border-2 border-primary-foreground/70 text-primary-foreground hover:bg-primary-foreground/10",
  choice: "glass text-foreground hover:bg-accent text-xl",
};

export function Btn({
  variant = "primary",
  loading,
  className,
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      type={type}
      disabled={rest.disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-lg font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-50",
        variants[variant],
        className,
      )}
    >
      {loading && <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-3xl border border-border bg-card p-5", className)}>{children}</div>;
}

export function Expandable({ title, tag, children }: { title: string; tag?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass rounded-3xl">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-3xl px-4 text-left font-semibold hover:bg-muted"
      >
        <span className="flex flex-wrap items-center gap-2">
          {title}
          {tag && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{tag}</span>}
        </span>
        <ChevronDown className={cn("size-5 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && <div className="animate-rise px-4 pb-4 text-muted-foreground">{children}</div>}
    </div>
  );
}

export function SimTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center gap-1 self-start rounded-md border border-dashed border-muted-foreground/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <Info className="size-3" aria-hidden />
      {children}
    </span>
  );
}

export function SecretBanner({ text }: { text: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border-2 border-warning bg-warning-soft p-4 text-foreground">
      <EyeOff className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
      <p className="flex-1 font-semibold">{text}</p>
    </div>
  );
}
