"use client";

import type { ReactNode } from "react";
import { Building2, Globe, Landmark, Laptop, LogOut, Mail, MapPin, Phone, Smartphone, User, Users, X } from "lucide-react";
import type { MockUser } from "@/lib/mock-users";
import { guessProvider, providerById } from "@/lib/providers";
import { Btn } from "./ui";

type UserProfileModalProps = {
  user: MockUser;
  isOpen: boolean;
  onClose: () => void;
  onSwitchUser: () => void;
  onLogout: () => void;
};

// Short names read faster than "OP Financial Group (Osuuspankki)".
const shortBank = (text: string) => providerById("bank", guessProvider("bank", text))?.name ?? text;
const shortOperator = (text: string) => providerById("operator", guessProvider("operator", text))?.name ?? text.split(" ")[0];
const maskIban = (iban: string) => `${iban.slice(0, 4)} •••• ${iban.replace(/\s/g, "").slice(-2)}`;
const deviceIcon = (name: string) => (/mac|laptop|pc|windows|thinkpad/i.test(name) ? Laptop : Smartphone);

const Tile = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => (
  <div className="grid justify-items-center gap-1 rounded-2xl bg-accent px-2 py-3 text-center">
    <span className="flex size-9 items-center justify-center rounded-full bg-card">{icon}</span>
    <span className="text-sm leading-tight font-semibold">{value}</span>
    <span className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</span>
  </div>
);

const Row = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
  <li className="flex min-w-0 items-center gap-2.5">
    <span className="shrink-0 text-muted-foreground">{icon}</span>
    <span className="truncate">{children}</span>
  </li>
);

const Chip = ({ children, mono }: { children: ReactNode; mono?: boolean }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full border border-border-strong px-2.5 py-1 text-xs ${mono ? "font-mono" : "font-medium"}`}>{children}</span>
);

export function UserProfileModal({ user, isOpen, onClose, onSwitchUser, onLogout }: UserProfileModalProps) {
  if (!isOpen) return null;

  const { personal, business } = user;
  const isBusiness = user.type === "small_business" && business;
  const bank = isBusiness ? business.corporateBank : personal.primaryBank;
  const iban = isBusiness ? business.corporateIban : personal.bankAccountIban;

  return (
    // A bottom sheet on phones, a centred card from the sm breakpoint up.
    <div
      role="dialog"
      aria-modal="true"
      aria-label={user.name}
      onClick={(event) => {
        // Tapping above the sheet closes it, as with any phone sheet.
        if (event.target === event.currentTarget && window.matchMedia("(max-width: 639px)").matches) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs sm:items-center sm:p-4"
    >
      <div className="grid max-h-[92dvh] w-full gap-5 overflow-y-auto overscroll-contain rounded-t-[28px] border-t border-border bg-card px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-foreground shadow-2xl motion-safe:animate-[sheet-up_.32s_cubic-bezier(.2,.9,.3,1)] sm:max-h-none sm:max-w-md sm:overflow-visible sm:rounded-3xl sm:border sm:p-5 sm:motion-safe:animate-[fade-up_.25s_ease-out]">
        <div className="-mb-2 flex justify-center sm:hidden" aria-hidden>
          <span className="h-1.5 w-10 rounded-full bg-border-strong" />
        </div>
        <div className="flex items-start gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-foreground text-lg font-bold text-background">{user.avatarInitials}</div>
          <div className="grid min-w-0 flex-1 gap-1">
            <h3 className="truncate text-lg font-bold">{user.name}</h3>
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold">
              {isBusiness ? <Building2 className="size-3.5" aria-hidden /> : <User className="size-3.5" aria-hidden />}
              {isBusiness ? business.companyName : "Consumer"}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground sm:size-9">
            <X className="size-4" />
          </button>
        </div>

        {/* What SafeStep uses to send the user to the right help. */}
        <div className="grid grid-cols-3 gap-2">
          <Tile icon={<Landmark className="size-4" aria-hidden />} label="Bank" value={shortBank(bank)} />
          <Tile icon={<Smartphone className="size-4" aria-hidden />} label="Mobile" value={shortOperator(personal.operatorSubscription)} />
          {isBusiness ? (
            <Tile icon={<Users className="size-4" aria-hidden />} label="Team" value={String(business.employeeCount)} />
          ) : (
            <Tile icon={<Laptop className="size-4" aria-hidden />} label="Devices" value={String(personal.registeredDevices.length)} />
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {personal.registeredDevices.map((device) => {
            const Icon = deviceIcon(device);
            return (
              <Chip key={device}>
                <Icon className="size-3.5" aria-hidden />
                {device}
              </Chip>
            );
          })}
        </div>

        <ul className="grid gap-2 text-sm">
          <Row icon={<Mail className="size-4" aria-hidden />}>{isBusiness ? business.businessEmail : personal.email}</Row>
          <Row icon={<Phone className="size-4" aria-hidden />}>{personal.phone}</Row>
          <Row icon={<MapPin className="size-4" aria-hidden />}>{isBusiness ? business.businessAddress : `${personal.address}, ${personal.city}`}</Row>
          {isBusiness && <Row icon={<Globe className="size-4" aria-hidden />}>{business.domain}</Row>}
        </ul>

        <div className="flex flex-wrap gap-1.5">
          <Chip mono>IBAN {maskIban(iban)}</Chip>
          {isBusiness ? <Chip mono>Y {business.businessId}</Chip> : <Chip mono>ID {personal.maskedSsn}</Chip>}
        </div>

        {/* On phones: Done and Switch as full-width thumb buttons, Log out under them. */}
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={onLogout} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium text-destructive hover:bg-danger-soft sm:min-h-10 sm:justify-start">
            <LogOut className="size-4" aria-hidden />
            Log out
          </button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Btn variant="plain" className="min-h-12 px-4 text-base sm:min-h-10 sm:text-sm" onClick={onSwitchUser}>
              Switch
            </Btn>
            <Btn variant="primary" className="min-h-12 px-4 text-base sm:min-h-10 sm:text-sm" onClick={onClose}>
              Done
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
