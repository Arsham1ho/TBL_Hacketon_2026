"use client";

import { Building2, User, ArrowLeft, ChevronRight } from "lucide-react";
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
      <main className="mx-auto flex w-full max-w-[460px] flex-1 flex-col px-4 py-8 max-sm:pt-10 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:justify-center">
        <div className="grid gap-6">
          <div className="grid justify-items-center gap-3 sm:hidden">
            <span className="flex size-16 items-center justify-center rounded-[22px] bg-foreground text-background shadow-lg">
              <StepMark className="size-8" />
            </span>
          </div>
          <div className="grid gap-1.5">
            <h1 className="text-center text-2xl font-bold tracking-tight max-sm:text-[28px]">Sign in to SafeStep</h1>
            <p className="text-center text-sm text-muted-foreground sm:hidden">Choose a demo account. You can switch at any time.</p>
          </div>

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
              className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border-strong bg-card p-4 transition-all hover:border-foreground/40 hover:bg-accent/20 max-sm:min-h-[76px] max-sm:rounded-2xl max-sm:active:scale-[.98] max-sm:active:bg-accent/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-foreground">
                  <User className="size-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold leading-snug text-foreground">{consumerUser.name}</h2>
                  <p className="text-xs text-muted-foreground">Regular Customer</p>
                </div>
              </div>
              <Btn
                variant="primary"
                className="min-h-9 px-4 text-xs pointer-events-none max-sm:hidden"
                tabIndex={-1}
              >
                Log in
              </Btn>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground sm:hidden" aria-hidden />
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
              className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border-strong bg-card p-4 transition-all hover:border-foreground/40 hover:bg-accent/20 max-sm:min-h-[76px] max-sm:rounded-2xl max-sm:active:scale-[.98] max-sm:active:bg-accent/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-foreground">
                  <Building2 className="size-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold leading-snug text-foreground">{businessUser.business?.companyName}</h2>
                  <p className="text-xs text-muted-foreground">Small Business</p>
                </div>
              </div>
              <Btn
                variant="primary"
                className="min-h-9 px-4 text-xs pointer-events-none max-sm:hidden"
                tabIndex={-1}
              >
                Log in
              </Btn>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground sm:hidden" aria-hidden />
            </div>
          </div>

          <div className="text-center max-sm:hidden">
            <button
              type="button"
              onClick={handleGuest}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Continue as guest
            </button>
          </div>
        </div>

        {/* On phones the guest choice is a full button within thumb reach. */}
        <div className="mt-auto grid gap-2 pt-8 sm:hidden">
          <button
            type="button"
            onClick={handleGuest}
            className="min-h-12 w-full rounded-full border border-border-strong bg-card text-base font-semibold text-foreground active:scale-[.98] active:bg-accent"
          >
            Continue as guest
          </button>
          <p className="text-center text-[11px] text-muted-foreground">Synthetic prototype. Demo accounts only.</p>
        </div>
      </main>
    </div>
  );
}
