import type { Audience } from "@/engine/types";

export type PersonalInfo = {
  fullName: string;
  birthDate: string;
  maskedSsn: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  primaryBank: string;
  bankAccountIban: string;
  registeredDevices: string[];
  operatorSubscription: string;
};

export type BusinessInfo = {
  companyName: string;
  businessId: string; // Y-tunnus
  vatNumber: string;
  industry: string;
  role: string;
  employeeCount: number;
  corporateBank: string;
  corporateIban: string;
  businessAddress: string;
  businessEmail: string;
  domain: string;
  subscriptionPlan: string;
};

export type MockUser = {
  id: string;
  username: string;
  password: string;
  type: Audience;
  name: string;
  roleTitle: string;
  avatarInitials: string;
  personal: PersonalInfo;
  business?: BusinessInfo;
};

export const MOCK_USERS: MockUser[] = [
  {
    id: "user-consumer-01",
    username: "customer",
    password: "customer123",
    type: "consumer",
    name: "Emma Korhonen",
    roleTitle: "Personal Customer",
    avatarInitials: "EK",
    personal: {
      fullName: "Emma Sofia Korhonen",
      birthDate: "1992-04-18",
      maskedSsn: "180492-***A",
      email: "emma.korhonen@example.fi",
      phone: "+358 40 123 4567",
      address: "Mannerheimintie 14 B 12",
      city: "Helsinki",
      postalCode: "00100",
      country: "Finland",
      primaryBank: "OP Financial Group (Osuuspankki)",
      bankAccountIban: "FI42 5000 1234 5678 90",
      registeredDevices: ["iPhone 15 Pro (iOS 18.2)", "MacBook Air M2 (macOS 15)"],
      operatorSubscription: "DNA Rajaton 5G 300M",
    },
  },
  {
    id: "user-business-01",
    username: "business",
    password: "business123",
    type: "small_business",
    name: "Mikko Virtanen",
    roleTitle: "Founder & Managing Director",
    avatarInitials: "MV",
    personal: {
      fullName: "Mikko Juhani Virtanen",
      birthDate: "1984-11-03",
      maskedSsn: "031184-***K",
      email: "mikko.virtanen@virtanendesign.fi",
      phone: "+358 50 987 6543",
      address: "Aleksanterinkatu 15 A 8",
      city: "Helsinki",
      postalCode: "00100",
      country: "Finland",
      primaryBank: "Nordea Bank Finland",
      bankAccountIban: "FI19 1234 0000 9876 54",
      registeredDevices: [
        "ThinkPad X1 Carbon (Windows 11 Pro)",
        "Samsung Galaxy S24 Ultra",
        "Office Firewall & Synology NAS",
      ],
      operatorSubscription: "DNA Business Pro 5G Voice & Data",
    },
    business: {
      companyName: "Virtanen Design & Consulting Oy",
      businessId: "2849102-4",
      vatNumber: "FI28491024",
      industry: "Digital Services & IT Consulting",
      role: "Managing Director",
      employeeCount: 8,
      corporateBank: "Danske Bank Corporate Banking",
      corporateIban: "FI89 8000 2712 3456 78",
      businessAddress: "Aleksanterinkatu 15 A, 00100 Helsinki",
      businessEmail: "billing@virtanendesign.fi",
      domain: "virtanendesign.fi",
      subscriptionPlan: "DNA Yritysverkko 1000M + 8 Business SIMs",
    },
  },
];

const STORAGE_KEY = "safestep_active_user_id";

export function authenticateUser(usernameInput: string, passwordInput: string): MockUser | null {
  const normalizedUser = usernameInput.trim().toLowerCase();
  const normalizedPass = passwordInput.trim();

  return (
    MOCK_USERS.find((u) => {
      const matchUser =
        u.username.toLowerCase() === normalizedUser ||
        u.personal.email.toLowerCase() === normalizedUser ||
        (u.type === "consumer" && (normalizedUser === "emma" || normalizedUser === "emma.korhonen")) ||
        (u.type === "small_business" && (normalizedUser === "mikko" || normalizedUser === "mikko.virtanen"));
      return matchUser && u.password === normalizedPass;
    }) ?? null
  );
}

export function getUserById(id: string | null): MockUser | null {
  if (!id) return null;
  return MOCK_USERS.find((u) => u.id === id) ?? null;
}

export function getStoredUser(): MockUser | null {
  if (typeof window === "undefined") return null;
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return getUserById(id);
  } catch {
    return null;
  }
}

export function setStoredUser(user: MockUser | null): void {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, user.id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore local storage restrictions
  }
}
