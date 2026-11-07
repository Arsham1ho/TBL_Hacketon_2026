// Official contact points for the services a user may need. Websites only where a phone
// number isn't certain: the user can find the right number there.
// `logo` is the provider's own icon, downloaded once from its official website into public/logos.
export type Provider = { id: string; name: string; website: string; logo: string };

export const BANKS: Provider[] = [
  { id: "nordea", name: "Nordea", website: "https://www.nordea.fi", logo: "/logos/nordea.png" },
  { id: "op", name: "OP", website: "https://www.op.fi", logo: "/logos/op.png" },
  { id: "danske", name: "Danske Bank", website: "https://danskebank.fi", logo: "/logos/danske.png" },
  { id: "spankki", name: "S-Pankki", website: "https://www.s-pankki.fi", logo: "/logos/spankki.png" },
  { id: "aktia", name: "Aktia", website: "https://www.aktia.fi", logo: "/logos/aktia.png" },
  { id: "handelsbanken", name: "Handelsbanken", website: "https://www.handelsbanken.fi", logo: "/logos/handelsbanken.png" },
  { id: "pop", name: "POP Pankki", website: "https://www.poppankki.fi", logo: "/logos/pop.png" },
  { id: "saastopankki", name: "Säästöpankki", website: "https://www.saastopankki.fi", logo: "/logos/saastopankki.png" },
  { id: "alandsbanken", name: "Ålandsbanken", website: "https://www.alandsbanken.fi", logo: "/logos/alandsbanken.png" },
];

export const OPERATORS: Provider[] = [
  { id: "dna", name: "DNA", website: "https://www.dna.fi", logo: "/logos/dna.svg" },
  { id: "elisa", name: "Elisa", website: "https://elisa.fi", logo: "/logos/elisa.png" },
  { id: "telia", name: "Telia", website: "https://www.telia.fi", logo: "/logos/telia.png" },
  { id: "moi", name: "Moi", website: "https://moi.fi", logo: "/logos/moi.png" },
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
