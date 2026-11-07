"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, OctagonAlert } from "lucide-react";
import type { Status } from "@/engine/types";
import { cn } from "@/lib/utils";

// Three stepping stones. It is SafeStep's own mark, so it stays unlike a shield or a spark.
export function StepMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" className={className} aria-hidden>
      <path d="M4 23.5c0-2.4 2.6-3.8 5.3-3.8 2.4 0 4 1.2 4 3 0 2.2-2.4 3.6-5 3.6-2.4 0-4.3-.9-4.3-2.8Z" />
      <path d="M13.2 14.8c.2-2.3 2.6-3.6 5-3.4 2.3.2 3.8 1.5 3.6 3.3-.2 2.1-2.5 3.4-4.9 3.2-2.4-.2-3.9-1.2-3.7-3.1Z" />
      <path d="M21.6 6.6c.3-1.9 2.4-3 4.3-2.7 1.9.3 3 1.5 2.8 3-.3 1.8-2.3 2.9-4.2 2.6-1.9-.3-3.2-1.2-2.9-2.9Z" />
    </svg>
  );
}

const statusStyle: Record<Status, { className: string; Icon: typeof CheckCircle2 }> = {
  safe: { className: "text-success", Icon: CheckCircle2 },
  needs_verification: { className: "text-warning", Icon: CircleHelp },
  threat_in_progress: { className: "text-destructive", Icon: OctagonAlert },
  incident_occurred: { className: "text-danger-deep", Icon: AlertTriangle },
};

export function StatusLabel({ status, label }: { status: Status; label: string }) {
  const { className, Icon } = statusStyle[status];
  return (
    <p className={cn("flex items-center gap-1.5 text-sm font-semibold", className)}>
      <Icon className="size-4" aria-hidden />
      {label}
    </p>
  );
}

type Variant = "primary" | "plain";

export function Btn({
  variant = "plain",
  className,
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      type={type}
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-lg px-4 py-2 text-base font-medium transition-colors disabled:opacity-40",
        variant === "primary" ? "bg-primary text-primary-foreground hover:opacity-90" : "border border-border-strong bg-card text-foreground hover:bg-accent",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SecretNote({ text }: { text: string }) {
  return <p className="border-l-2 border-warning pl-3 text-sm text-foreground">{text}</p>;
}

export function Details({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-muted-foreground underline underline-offset-4">{title}</summary>
      <div className="mt-1 grid gap-3 text-muted-foreground">{children}</div>
    </details>
  );
}
