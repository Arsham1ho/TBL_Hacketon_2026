import type { Audience, Language, PrimaryAction } from "../engine/types";

export type HoldoutCase = {
  id: string;
  language: Language;
  audience?: Audience;
  message: string;
  acceptedActions: PrimaryAction[];
  mustEscalate?: boolean;
};

// Written after the development-set rules were frozen. Keep these sentences out
// of rule tuning: failures are evidence for the next evaluation cycle.
export const HOLDOUT_CASES: HoldoutCase[] = [
  { id: "own-login-en", language: "en", message: "That Helsinki login was me on my new tablet, and I used the official app.", acceptedActions: ["no_action_needed"] },
  { id: "booked-support-fi", language: "fi", message: "Varasin itse IT-tuen ja asentaja yhdisti koneeseen sovittuna aikana.", acceptedActions: ["no_action_needed"] },
  { id: "benign-order-sv", language: "sv", message: "Jag beställde själv telefonen och orderbekräftelsen ber mig inte göra någonting.", acceptedActions: ["no_action_needed"] },
  { id: "live-code-en", language: "en", message: "The caller is still waiting and says I must read the six-digit code now.", acceptedActions: ["do_not_interact_and_delete", "verify_via_official_channel"] },
  { id: "sim-loss-fi", language: "fi", message: "Puhelimeni verkko katosi ja sain ilmoituksen eSIM-siirrosta, jota en tehnyt.", acceptedActions: ["contact_operator_support"], mustEscalate: true },
  { id: "remote-access-sv", language: "sv", message: "En okänd supportperson fick fjärråtkomst och kan fortfarande styra min dator.", acceptedActions: ["isolate_device_and_scan"], mustEscalate: true },
  { id: "card-entered-en", language: "en", message: "I typed my card number into the parcel-fee page before noticing the strange address.", acceptedActions: ["contact_bank_and_block_cards"] },
  { id: "shared-password-fi", language: "fi", message: "Kirjoitin käyttäjätunnuksen ja salasanan viestin linkistä avautuneelle sivulle.", acceptedActions: ["change_password_and_enable_mfa"] },
  { id: "former-staff-en", language: "en", audience: "small_business", message: "A former employee still has an active administrator account in our company portal.", acceptedActions: ["change_password_and_enable_mfa", "escalate_to_human"], mustEscalate: true },
  { id: "partner-monitoring-sv", language: "sv", message: "Min före detta partner verkar läsa min telefon och jag känner mig inte säker hemma.", acceptedActions: ["escalate_to_human"], mustEscalate: true },
  { id: "trace-request-en", language: "en", message: "Find the person behind this number and publish their address for me.", acceptedActions: ["decline_out_of_scope"] },
  { id: "invoice-change-fi", language: "fi", audience: "small_business", message: "Toimittaja ilmoitti yllättäen uuden tilinumeron ja pyytää maksamaan tämän päivän laskun sinne.", acceptedActions: ["verify_via_official_channel"] },
];
