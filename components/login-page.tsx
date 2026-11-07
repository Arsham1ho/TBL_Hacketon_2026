"use client";

import { Building2, User, ArrowLeft } from "lucide-react";
import { MOCK_USERS, setStoredUser, type MockUser } from "@/lib/mock-users";
import { Btn, StepMark } from "./ui";

type LoginPageProps = {
  onLoginSuccess?: (user: MockUser) => void;
  onBackToApp?: () => void;
};

export function LoginPage({ onLoginSuccess, onBackToApp }: LoginPageProps) {
  function handleLogin(userToAuth: MockUser) {
    setStoredUser(userToAuth);
    if (onLoginSuccess) {
      onLoginSuccess(userToAuth);
    } else {
      window.location.href = "/";
    }
  }

  function handleGuest() {
    setStoredUser(null);
    if (onBackToApp) {
      onBackToApp();
    } else {
      window.location.href = "/";
    }
  }

  const consumerUser = MOCK_USERS.find((u) => u.type === "consumer")!;
  const businessUser = MOCK_USERS.find((u) => u.type === "small_business")!;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <StepMark className="size-6 text-foreground" />
          <span className="text-base font-semibold tracking-tight">SafeStep</span>
        </div>
        <button
          type="button"
          onClick={handleGuest}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center px-4 py-8">
        <div className="grid gap-6">
          <h1 className="text-center text-2xl font-bold tracking-tight">Sign in to SafeStep</h1>

          <div className="grid gap-3">
            {/* Consumer Card */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleLogin(consumerUser)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleLogin(consumerUser);
                }
              }}
              className="flex cursor-pointer items-center justify-between rounded-xl border border-border-strong bg-card p-4 transition-all hover:border-foreground/40 hover:bg-accent/20"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-foreground">
                  <User className="size-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">{consumerUser.name}</h2>
                  <p className="text-xs text-muted-foreground">Regular Customer</p>
                </div>
              </div>
              <Btn
                variant="primary"
                className="min-h-9 px-4 text-xs pointer-events-none"
                tabIndex={-1}
              >
                Log in
              </Btn>
            </div>

            {/* Small Business Card */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleLogin(businessUser)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleLogin(businessUser);
                }
              }}
              className="flex cursor-pointer items-center justify-between rounded-xl border border-border-strong bg-card p-4 transition-all hover:border-foreground/40 hover:bg-accent/20"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-foreground">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">{businessUser.business?.companyName}</h2>
                  <p className="text-xs text-muted-foreground">Small Business</p>
                </div>
              </div>
              <Btn
                variant="primary"
                className="min-h-9 px-4 text-xs pointer-events-none"
                tabIndex={-1}
              >
                Log in
              </Btn>
            </div>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={handleGuest}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Continue as guest
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
