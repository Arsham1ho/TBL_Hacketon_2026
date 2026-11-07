"use client";

import { useState } from "react";
import {
  Building2,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Shield,
  Smartphone,
  User,
  AlertCircle,
  ArrowLeft,
  CreditCard,
  Briefcase,
} from "lucide-react";
import { MOCK_USERS, authenticateUser, setStoredUser, type MockUser } from "@/lib/mock-users";
import { Btn, StepMark } from "./ui";
import { cn } from "@/lib/utils";

type LoginPageProps = {
  onLoginSuccess?: (user: MockUser) => void;
  onBackToApp?: () => void;
};

export function LoginPage({ onLoginSuccess, onBackToApp }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<MockUser | null>(null);

  function handleLogin(userToAuth?: MockUser) {
    setError(null);
    if (userToAuth) {
      setStoredUser(userToAuth);
      if (onLoginSuccess) {
        onLoginSuccess(userToAuth);
      } else {
        window.location.href = "/";
      }
      return;
    }

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }

    const matched = authenticateUser(username, password);
    if (!matched) {
      setError("Invalid username or password. Try 'customer' / 'customer123' or 'business' / 'business123'.");
      return;
    }

    setStoredUser(matched);
    if (onLoginSuccess) {
      onLoginSuccess(matched);
    } else {
      window.location.href = "/";
    }
  }

  const consumerUser = MOCK_USERS.find((u) => u.type === "consumer")!;
  const businessUser = MOCK_USERS.find((u) => u.type === "small_business")!;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Top Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <StepMark className="size-6 text-foreground" />
          <span className="text-base font-semibold tracking-tight">SafeStep</span>
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Identity Portal
          </span>
        </div>
        {onBackToApp && (
          <button
            type="button"
            onClick={onBackToApp}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Chat
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col justify-center px-4 py-8">
        <div className="grid gap-6">
          {/* Hero Heading */}
          <div className="text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-accent text-foreground">
              <Shield className="size-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Sign in to SafeStep</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Choose a test persona to explore custom security flows for consumers or businesses.
            </p>
          </div>

          {/* Quick 1-Click Test Users */}
          <div className="grid gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Instant 1-Click Test Personas
            </h2>

            {/* Consumer Card */}
            <div className="relative rounded-xl border border-border-strong bg-card p-4 transition-all hover:border-foreground/30 hover:shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-foreground">
                    <User className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{consumerUser.name}</h3>
                      <span className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium text-foreground">
                        Regular Customer
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{consumerUser.personal.email}</p>
                  </div>
                </div>
                <Btn
                  variant="primary"
                  className="min-h-9 px-3 py-1 text-xs"
                  onClick={() => handleLogin(consumerUser)}
                >
                  Log in as Emma
                </Btn>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CreditCard className="size-3.5 shrink-0" />
                  <span className="truncate">{consumerUser.personal.primaryBank}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Smartphone className="size-3.5 shrink-0" />
                  <span className="truncate">{consumerUser.personal.operatorSubscription}</span>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Credentials: <code className="rounded bg-accent px-1 py-0.5">customer</code> /{" "}
                  <code className="rounded bg-accent px-1 py-0.5">customer123</code>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPreview(consumerUser)}
                  className="underline hover:text-foreground"
                >
                  View mock data
                </button>
              </div>
            </div>

            {/* Small Business Card */}
            <div className="relative rounded-xl border border-border-strong bg-card p-4 transition-all hover:border-foreground/30 hover:shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-foreground">
                    <Building2 className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{businessUser.business?.companyName}</h3>
                      <span className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium text-foreground">
                        Small Business
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {businessUser.name} · {businessUser.roleTitle}
                    </p>
                  </div>
                </div>
                <Btn
                  variant="primary"
                  className="min-h-9 px-3 py-1 text-xs"
                  onClick={() => handleLogin(businessUser)}
                >
                  Log in as Mikko
                </Btn>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Briefcase className="size-3.5 shrink-0" />
                  <span className="truncate">Y-tunnus: {businessUser.business?.businessId}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CreditCard className="size-3.5 shrink-0" />
                  <span className="truncate">{businessUser.business?.corporateBank}</span>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Credentials: <code className="rounded bg-accent px-1 py-0.5">business</code> /{" "}
                  <code className="rounded bg-accent px-1 py-0.5">business123</code>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPreview(businessUser)}
                  className="underline hover:text-foreground"
                >
                  View mock data
                </button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="relative my-1 flex items-center justify-center">
            <div className="w-full border-t border-border" />
            <span className="absolute bg-background px-3 text-xs uppercase tracking-wider text-muted-foreground">
              Or sign in with username
            </span>
          </div>

          {/* Standard Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="grid gap-3 rounded-xl border border-border p-4 bg-card"
          >
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-xs font-medium text-danger-deep">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid gap-1">
              <label htmlFor="login-username" className="text-xs font-semibold text-foreground">
                Username or Email
              </label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="customer or business"
                className="h-11 rounded-lg border border-border-strong bg-white px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div className="grid gap-1">
              <label htmlFor="login-password" className="text-xs font-semibold text-foreground">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="h-11 w-full rounded-lg border border-border-strong bg-white px-3 pr-10 text-sm text-foreground focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Btn type="submit" variant="primary" className="mt-1 h-11 w-full">
              Sign In
            </Btn>
          </form>

          {/* Guest fallback */}
          {onBackToApp && (
            <div className="text-center text-xs text-muted-foreground">
              Don't want to sign in?{" "}
              <button
                type="button"
                onClick={() => {
                  setStoredUser(null);
                  onBackToApp();
                }}
                className="font-medium underline hover:text-foreground"
              >
                Continue as anonymous guest
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Mock Data Inspection Dialog */}
      {selectedPreview && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl text-foreground">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold">{selectedPreview.name}</h3>
                <p className="text-xs text-muted-foreground">
                  Persona Profile & Mock Data ({selectedPreview.type === "consumer" ? "Consumer" : "Small Business"})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreview(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto pr-1 text-xs">
              <section className="grid gap-1">
                <h4 className="font-semibold text-foreground">Personal Information</h4>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-accent/50 p-2.5">
                  <div>
                    <span className="text-muted-foreground">Full Name:</span> {selectedPreview.personal.fullName}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Birth Date:</span> {selectedPreview.personal.birthDate}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Masked SSN:</span> {selectedPreview.personal.maskedSsn}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone:</span> {selectedPreview.personal.phone}
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Address:</span> {selectedPreview.personal.address},{" "}
                    {selectedPreview.personal.postalCode} {selectedPreview.personal.city}
                  </div>
                </div>
              </section>

              {selectedPreview.business && (
                <section className="grid gap-1">
                  <h4 className="font-semibold text-foreground">Business Information</h4>
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-accent/50 p-2.5">
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Company:</span>{" "}
                      {selectedPreview.business.companyName}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Business ID:</span>{" "}
                      {selectedPreview.business.businessId}
                    </div>
                    <div>
                      <span className="text-muted-foreground">VAT:</span> {selectedPreview.business.vatNumber}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Staff:</span>{" "}
                      {selectedPreview.business.employeeCount} employees
                    </div>
                    <div>
                      <span className="text-muted-foreground">Domain:</span> {selectedPreview.business.domain}
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Corporate Bank:</span>{" "}
                      {selectedPreview.business.corporateBank} ({selectedPreview.business.corporateIban})
                    </div>
                  </div>
                </section>
              )}

              <section className="grid gap-1">
                <h4 className="font-semibold text-foreground">Digital Assets & Security Context</h4>
                <div className="grid gap-1.5 rounded-lg bg-accent/50 p-2.5">
                  <div>
                    <span className="text-muted-foreground">Registered Devices:</span>
                    <ul className="mt-1 list-disc pl-4 space-y-0.5">
                      {selectedPreview.personal.registeredDevices.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="pt-1">
                    <span className="text-muted-foreground">Operator & Connectivity:</span>{" "}
                    {selectedPreview.personal.operatorSubscription}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Primary Banking:</span>{" "}
                    {selectedPreview.personal.primaryBank} ({selectedPreview.personal.bankAccountIban})
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-3">
              <Btn variant="plain" className="min-h-9 px-3 text-xs" onClick={() => setSelectedPreview(null)}>
                Close
              </Btn>
              <Btn
                variant="primary"
                className="min-h-9 px-3 text-xs"
                onClick={() => {
                  const target = selectedPreview;
                  setSelectedPreview(null);
                  handleLogin(target);
                }}
              >
                Sign in as this user
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
