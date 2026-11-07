// Official contact points for the services a user may need. Websites only where a phone
// number isn't certain: the user can find the right number there.
export type Provider = { id: string; name: string; website: string };

export const BANKS: Provider[] = [
  { id: "nordea", name: "Nordea", website: "https://www.nordea.fi" },
  { id: "op", name: "OP", website: "https://www.op.fi" },
  { id: "danske", name: "Danske Bank", website: "https://danskebank.fi" },
  { id: "spankki", name: "S-Pankki", website: "https://www.s-pankki.fi" },
  { id: "aktia", name: "Aktia", website: "https://www.aktia.fi" },
  { id: "handelsbanken", name: "Handelsbanken", website: "https://www.handelsbanken.fi" },
  { id: "pop", name: "POP Pankki", website: "https://www.poppankki.fi" },
  { id: "saastopankki", name: "Säästöpankki", website: "https://www.saastopankki.fi" },
  { id: "alandsbanken", name: "Ålandsbanken", website: "https://www.alandsbanken.fi" },
];

export const OPERATORS: Provider[] = [
  { id: "dna", name: "DNA", website: "https://www.dna.fi" },
  { id: "elisa", name: "Elisa", website: "https://elisa.fi" },
  { id: "telia", name: "Telia", website: "https://www.telia.fi" },
  { id: "moi", name: "Moi", website: "https://moi.fi" },
];

// The shared card blocking service for cards issued in Finland.
export const CARD_BLOCKING = { display: "020 333", tel: "+35820333" };
export const POLICE = { website: "https://poliisi.fi", emergency: "112" };

export type ProviderKind = "bank" | "operator";
export type ProviderChoice = Partial<Record<ProviderKind, string>>;

export const providerById = (kind: ProviderKind, id?: string) => (kind === "bank" ? BANKS : OPERATORS).find((item) => item.id === id);

// Picks a provider from free text, such as a logged-in profile's "OP Financial Group".
export function guessProvider(kind: ProviderKind, text?: string): string | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  return (kind === "bank" ? BANKS : OPERATORS).find((item) => lower.includes(item.name.toLowerCase()) || lower.startsWith(item.id))?.id;
}
