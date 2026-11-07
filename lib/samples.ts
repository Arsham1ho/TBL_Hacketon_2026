import type { Audience, Language } from "../engine/types";

// Examples for the empty description field. They are placeholders only and are never
// submitted. Each one is a typical case SafeStep handles, so people see what they can ask.
type Sample = Record<Language, string>;

const CONSUMER: Sample[] = [
  {
    en: "I got a text asking me to pay for a parcel",
    fi: "Sain tekstiviestin, jossa pyydetään maksamaan paketista",
    sv: "Jag fick ett sms om att betala för ett paket",
  },
  {
    en: "Someone from my bank called and asked for a code",
    fi: "Pankista soitettiin ja pyydettiin koodia",
    sv: "Någon från banken ringde och bad om en kod",
  },
  {
    en: "I clicked a link and typed my banking codes",
    fi: "Klikkasin linkkiä ja syötin pankkitunnukseni",
    sv: "Jag klickade på en länk och skrev in mina bankkoder",
  },
  {
    en: "My phone suddenly says No SIM",
    fi: "Puhelimeni näyttää yhtäkkiä Ei SIM-korttia",
    sv: "Min telefon visar plötsligt Inget SIM-kort",
  },
  {
    en: "I got a login alert I don't recognise",
    fi: "Sain kirjautumisilmoituksen, jota en tunnista",
    sv: "Jag fick en inloggningsvarning som jag inte känner igen",
  },
  {
    en: "A message says my tax refund is waiting",
    fi: "Viestin mukaan veronpalautukseni odottaa",
    sv: "Ett meddelande säger att min skatteåterbäring väntar",
  },
  {
    en: "Someone wants me to install an app for remote help",
    fi: "Joku haluaa, että asennan etätukisovelluksen",
    sv: "Någon vill att jag installerar en app för fjärrhjälp",
  },
  {
    en: "I keep getting approval requests I didn't start",
    fi: "Saan jatkuvasti hyväksyntäpyyntöjä, joita en tehnyt",
    sv: "Jag får hela tiden godkännandeförfrågningar som jag inte startat",
  },
  {
    en: "A friend messaged asking to borrow money urgently",
    fi: "Ystävä pyysi viestillä kiireesti rahaa lainaksi",
    sv: "En vän skrev och bad att få låna pengar snabbt",
  },
  {
    en: "I got an order confirmation for something I didn't buy",
    fi: "Sain tilausvahvistuksen tuotteesta, jota en ostanut",
    sv: "Jag fick en orderbekräftelse på något jag inte köpt",
  },
];

const BUSINESS: Sample[] = [
  {
    en: "A supplier asked us to change their bank details",
    fi: "Toimittaja pyysi meitä vaihtamaan pankkitiedot",
    sv: "En leverantör bad oss ändra sina bankuppgifter",
  },
  {
    en: "Our CEO emailed asking for an urgent transfer",
    fi: "Toimitusjohtaja pyysi sähköpostilla kiireellistä tilisiirtoa",
    sv: "Vår vd mejlade och bad om en brådskande överföring",
  },
  {
    en: "An employee typed their password on a fake login page",
    fi: "Työntekijä syötti salasanansa valekirjautumissivulle",
    sv: "En anställd skrev sitt lösenord på en falsk inloggningssida",
  },
  {
    en: "Files on our shared drive are suddenly encrypted",
    fi: "Yhteisen levyn tiedostot ovat yhtäkkiä salattuja",
    sv: "Filerna på vår delade disk är plötsligt krypterade",
  },
  {
    en: "A former employee still has access to our systems",
    fi: "Entisellä työntekijällä on yhä pääsy järjestelmiimme",
    sv: "En tidigare anställd har fortfarande åtkomst till våra system",
  },
  {
    en: "Customers got invoices from our email that we didn't send",
    fi: "Asiakkaat saivat sähköpostistamme laskuja, joita emme lähettäneet",
    sv: "Kunder fick fakturor från vår mejl som vi inte skickat",
  },
  {
    en: "Someone logged in to our company account from abroad",
    fi: "Joku kirjautui yrityksen tilille ulkomailta",
    sv: "Någon loggade in på företagets konto från utlandet",
  },
  {
    en: "Our mailbox has forwarding rules nobody created",
    fi: "Postilaatikossamme on edelleenlähetyssääntöjä, joita kukaan ei tehnyt",
    sv: "Vår brevlåda har vidarebefordringsregler som ingen skapat",
  },
  {
    en: "We got a notice that our customer data leaked",
    fi: "Saimme ilmoituksen, että asiakastietojamme on vuotanut",
    sv: "Vi fick ett meddelande om att våra kunddata läckt",
  },
  {
    en: "Unknown devices appeared on our office network",
    fi: "Toimiston verkkoon ilmestyi tuntemattomia laitteita",
    sv: "Okända enheter dök upp i kontorets nätverk",
  },
];

export const SAMPLE_COUNT = CONSUMER.length;

export const sampleText = (audience: Audience, index: number, language: Language) =>
  (audience === "consumer" ? CONSUMER : BUSINESS)[index % SAMPLE_COUNT][language];

// A different example from the current one.
export function nextSample(current: number) {
  const step = 1 + Math.floor(Math.random() * (SAMPLE_COUNT - 1));
  return (current + step) % SAMPLE_COUNT;
}
