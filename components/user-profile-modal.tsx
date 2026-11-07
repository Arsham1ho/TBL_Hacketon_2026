"use client";

import {
  Building2,
  Check,
  CreditCard,
  LogOut,
  Shield,
  Smartphone,
  User,
  X,
  Briefcase,
  Users,
  Globe,
} from "lucide-react";
import type { MockUser } from "@/lib/mock-users";
import { Btn } from "./ui";

type UserProfileModalProps = {
  user: MockUser;
  isOpen: boolean;
  onClose: () => void;
  onSwitchUser: () => void;
  onLogout: () => void;
};

export function UserProfileModal({
  user,
  isOpen,
  onClose,
  onSwitchUser,
  onLogout,
}: UserProfileModalProps) {
  if (!isOpen) return null;

  const isBusiness = user.type === "small_business";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="User Profile"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl text-foreground">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-border pb-3">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-accent font-bold text-foreground">
              {isBusiness ? <Building2 className="size-5" /> : <User className="size-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">{user.name}</h3>
                <span className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-semibold text-foreground">
                  {isBusiness ? "Small Business" : "Consumer"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{user.roleTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto pr-1 text-xs">
          {/* Business Info (if business) */}
          {isBusiness && user.business && (
            <section className="grid gap-1.5 rounded-xl border border-border bg-accent/30 p-3">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Briefcase className="size-3.5" />
                <span>Company Overview</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-foreground">
                <div className="col-span-2">
                  <span className="text-muted-foreground">Entity:</span> {user.business.companyName}
                </div>
                <div>
                  <span className="text-muted-foreground">Business ID:</span> {user.business.businessId}
                </div>
                <div>
                  <span className="text-muted-foreground">VAT:</span> {user.business.vatNumber}
                </div>
                <div>
                  <span className="text-muted-foreground">Team:</span> {user.business.employeeCount} staff
                </div>
                <div>
                  <span className="text-muted-foreground">Domain:</span> {user.business.domain}
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Corporate Bank:</span> {user.business.corporateBank}
                </div>
                <div className="col-span-2 text-[11px] text-muted-foreground font-mono">
                  IBAN: {user.business.corporateIban}
                </div>
              </div>
            </section>
          )}

          {/* Personal Info */}
          <section className="grid gap-1.5 rounded-xl border border-border bg-accent/30 p-3">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <User className="size-3.5" />
              <span>Personal Details</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-foreground">
              <div>
                <span className="text-muted-foreground">Legal Name:</span> {user.personal.fullName}
              </div>
              <div>
                <span className="text-muted-foreground">SSN:</span> {user.personal.maskedSsn}
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span> {user.personal.email}
              </div>
              <div>
                <span className="text-muted-foreground">Phone:</span> {user.personal.phone}
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Address:</span> {user.personal.address},{" "}
                {user.personal.postalCode} {user.personal.city}
              </div>
            </div>
          </section>

          {/* Registered Devices & Network */}
          <section className="grid gap-1.5 rounded-xl border border-border bg-accent/30 p-3">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Smartphone className="size-3.5" />
              <span>Registered Devices & Network Security</span>
            </div>
            <div className="grid gap-2 text-foreground">
              <div>
                <span className="text-muted-foreground">Active Devices:</span>
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  {user.personal.registeredDevices.map((device) => (
                    <li key={device}>{device}</li>
                  ))}
                </ul>
              </div>
              <div className="border-t border-border/60 pt-2">
                <span className="text-muted-foreground">Connectivity:</span>{" "}
                {user.personal.operatorSubscription}
              </div>
              <div>
                <span className="text-muted-foreground">Primary Bank:</span> {user.personal.primaryBank}
              </div>
              <div className="text-[11px] text-muted-foreground font-mono">
                IBAN: {user.personal.bankAccountIban}
              </div>
            </div>
          </section>
        </div>

        {/* Modal Actions */}
        <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-danger-soft"
          >
            <LogOut className="size-3.5" />
            Log Out (Guest Mode)
          </button>
          <div className="flex items-center gap-2">
            <Btn variant="plain" className="min-h-9 px-3 text-xs" onClick={onSwitchUser}>
              Switch User
            </Btn>
            <Btn variant="primary" className="min-h-9 px-3 text-xs" onClick={onClose}>
              Done
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
