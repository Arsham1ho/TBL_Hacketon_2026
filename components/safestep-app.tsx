"use client";

import { useEffect, useRef, useState } from "react";
import {
  Building2,
  Check,
  KeyRound,
  Shield,
  Signal,
  SlidersHorizontal,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { DEMO_SCENARIOS, type DemoScenario } from "@/adapters/signals";
import { maskSecrets } from "@/engine/input-guard";
import type { ApiRequest, ApiResponse } from "@/engine/screens";
import type { Audience, Language } from "@/engine/types";
import { client, type AgentPreview } from "@/lib/client";
import { getStoredUser, setStoredUser, type MockUser } from "@/lib/mock-users";
import { translator, type TextKey } from "@/lib/ui-text";
import { cn } from "@/lib/utils";
import { demoScreen } from "@/mocks/journey";
import { DescriptionComposer } from "./composer";
import { LoginPage } from "./login-page";
import { agentTurn, screenTurn, type Reply } from "./turns";
import { Btn, SecretNote, StepMark } from "./ui";
import { UserProfileModal } from "./user-profile-modal";

const LANGUAGES: { code: Language; label: string }[] = [
  { code: "fi", label: "Suomi" },
  { code: "en", label: "English" },
  { code: "sv", label: "Svenska" },
];

export type AttackScenario = {
  id: string;
  icon: string;
  signal: DemoScenario;
  title: Record<Language, string>;
  description: Record<Language, string>;
  text: Record<Language, string>;
};

export const RICH_CONSUMER_SCENARIOS: AttackScenario[] = [
  {
    id: "phishing_sms",
    icon: "📦",
    signal: "flagged_link",
    title: {
      en: "Delivery Phishing SMS",
      fi: "Pakettihuijauksen tekstiviesti",
      sv: "Bluff-sms om paket",
    },
    description: {
      en: "Unpaid parcel fee SMS with a suspicious payment link",
      fi: "Tekstiviesti saapuneesta paketista ja maksulinkki",
      sv: "Falskt sms om paketavgift med betallänk",
    },
    text: {
      en: "I got a text saying I have an unpaid package fee of €2.90 with a link to pay.",
      fi: "Sain tekstiviestin, jossa väitetään että minulla on 2,90 € maksamaton pakettimaksu ja linkki sen maksamiseen.",
      sv: "Jag fick ett sms om en obetald paketavgift på 2,90 € och en länk för att betala.",
    },
  },
  {
    id: "bank_call",
    icon: "📞",
    signal: "warned_call",
    title: {
      en: "Bank Impostor Call",
      fi: "Pankkihuijauspuhelu",
      sv: "Bluffsamtal från banken",
    },
    description: {
      en: "Caller pretending to be bank security demanding codes",
      fi: "Pankin turvaosastoksi tekeytyvä soittaja vaatii koodeja",
      sv: "Uppringare från påstådd säkerhetsavdelning begär koder",
    },
    text: {
      en: "Someone called claiming to be from my bank's fraud security team, asking for a code from my SMS to cancel a suspicious wire.",
      fi: "Joku soitti väittäen olevansa pankkini turvaosastolta ja pyysi tekstiviestikoodia peruakseen epäilyttävän tilisiirron.",
      sv: "Någon ringde och påstod sig vara från min banks säkerhetsavdelning och bad om en sms-kod för att stoppa en betalning.",
    },
  },
  {
    id: "bank_credentials",
    icon: "💳",
    signal: "flagged_link",
    title: {
      en: "Bank Credentials Leaked",
      fi: "Pankkitunnukset syötetty valesivulle",
      sv: "Bankinloggning på nätfiskelänk",
    },
    description: {
      en: "Clicked tax refund link and typed online banking credentials",
      fi: "Klikkasi veronpalautuslinkkiä ja syötti verkkopankkitunnuksensa",
      sv: "Klickade på återbäringslänk och angav bankkoder",
    },
    text: {
      en: "I clicked an SMS link about a tax refund and typed my online banking codes and personal ID on the site.",
      fi: "Klikkasin tekstiviestin veronpalautuslinkkiä ja syötin sivustolle verkkopankkitunnukseni ja henkilötunnukseni.",
      sv: "Jag klickade på en länk om skatteåterbäring och angav mina bankkoder och mitt personnummer.",
    },
  },
  {
    id: "sim_swap",
    icon: "📲",
    signal: "sim_change",
    title: {
      en: "SIM Hijacked / No Service",
      fi: "SIM-kaappaus / Verkko poikki",
      sv: "SIM-kapning / Ingen täckning",
    },
    description: {
      en: "Phone lost mobile network; unauthorized eSIM swap detected",
      fi: "Puhelimesta katkesi verkko; luvaton eSIM-siirto havaittu",
      sv: "Mobilen tappade nätet; misstänkt obehörigt eSIM-byte",
    },
    text: {
      en: "My phone suddenly lost network connection and says 'No SIM'. I suspect an unauthorized SIM swap.",
      fi: "Puhelimestani katkesi yhtäkkiä verkko ja se ilmoittaa 'Ei SIM-korttia'. Epäilen luvatonta SIM-vaihtoa.",
      sv: "Min telefon tappade plötsligt nätet och visar 'Inget SIM-kort'. Jag misstänker en obehörig SIM-flytt.",
    },
  },
  {
    id: "hacked_phone",
    icon: "📱",
    signal: "device_issue",
    title: {
      en: "Hacked Device / Rogue App",
      fi: "Kaapattu puhelin / Outo sovellus",
      sv: "Kapard mobil / Okänd app",
    },
    description: {
      en: "Phone overheating with unfamiliar remote access app installed",
      fi: "Puhelin kuumenee ja sinne on asentunut tuntematon etätukisovellus",
      sv: "Telefonen överhettas och en okänd app har installerats",
    },
    text: {
      en: "My phone got hacked; an unfamiliar remote desktop app was installed and my screen keeps tapping on its own.",
      fi: "Puhelimeni on kaapattu; sinne on ilmestynyt outo etähallintasovellus ja näyttö tekee toimintoja itsestään.",
      sv: "Min telefon har blivit hackad; en okänd app har installerats och skärmen agerar av sig själv.",
    },
  },
];

export const RICH_BUSINESS_SCENARIOS: AttackScenario[] = [
  {
    id: "ceo_fraud",
    icon: "💼",
    signal: "warned_call",
    title: {
      en: "CEO Fraud / Wire Transfer",
      fi: "Toimitusjohtajahuijaus",
      sv: "VD-bedrägeri / Överföring",
    },
    description: {
      en: "Urgent email purporting to be from CEO requesting wire transfer",
      fi: "Toimitusjohtajan nimissä tullut kiireellinen tilisiirtopyyntö",
      sv: "Brådskande mejl i VD:s namn med krav på banköverföring",
    },
    text: {
      en: "Our accounts department received an urgent email purporting to be our CEO demanding an immediate €18,000 wire transfer.",
      fi: "Talousosastomme sai toimitusjohtajan nimissä tulleen kiireellisen sähköpostin, jossa pyydetään välitöntä 18 000 euron tilisiirtoa.",
      sv: "Vår ekonomiavdelning fick ett brådskande mejl i VD:s namn som krävde en omedelbar överföring på 18 000 €.",
    },
  },
  {
    id: "fake_invoice",
    icon: "🧾",
    signal: "flagged_link",
    title: {
      en: "Changed Vendor Bank Account",
      fi: "Toimittajan muuttunut tilinumero",
      sv: "Ändrat leverantörskonto",
    },
    description: {
      en: "Vendor email asking to route invoice payments to new foreign IBAN",
      fi: "Toimittajan sähköposti pyytää maksamaan laskun uudelle tilille",
      sv: "Leverantörsmejl ber om betalning till ett nytt konto",
    },
    text: {
      en: "A supplier emailed us stating their bank account has changed and asked us to pay a €6,400 invoice to a new overseas account.",
      fi: "Toimittaja ilmoitti sähköpostitse tilinumeronsa vaihtuneen ja pyysi maksamaan 6 400 euron laskun uudelle ulkomaiselle tilille.",
      sv: "En leverantör mejlade om ändrade bankuppgifter och bad oss betala en faktura på 6 400 € till ett nytt konto.",
    },
  },
  {
    id: "m365_phishing",
    icon: "📧",
    signal: "unknown_login",
    title: {
      en: "Staff Microsoft 365 Phishing",
      fi: "Henkilöstön M365-kalastelu",
      sv: "Nätfiske mot M365-konton",
    },
    description: {
      en: "Employee entered company login credentials on fake document portal",
      fi: "Työntekijä syötti työsähköpostin salasanan tekaistulle jakosivulle",
      sv: "Anställd angav Microsoft 365-lösenord på en falsk webbplats",
    },
    text: {
      en: "An employee entered our company Microsoft 365 credentials on a fake SharePoint link they received by email.",
      fi: "Työntekijämme syötti yrityksen Microsoft 365 -tunnukset sähköpostitse saamaansa väärennettyyn SharePoint-linkkiin.",
      sv: "En medarbetare angav företagets Microsoft 365-inloggning på en falsk SharePoint-länk som kom via mejl.",
    },
  },
  {
    id: "former_employee",
    icon: "👥",
    signal: "business_access",
    title: {
      en: "Former Staff Active Access",
      fi: "Entisen työntekijän tunnukset",
      sv: "Före detta anställds behörigheter",
    },
    description: {
      en: "Offboarded staff member still has active access to customer systems",
      fi: "Yrityksestä lähteneellä henkilöllä edelleen pääsy järjestelmiin",
      sv: "Tidigare anställd har fortfarande tillgång till företagets system",
    },
    text: {
      en: "A former employee who left our company last week still has active credentials and access to our corporate Google Workspace and CRM.",
      fi: "Viime viikolla yrityksestämme lähteneellä työntekijällä on yhä aktiiviset tunnukset ja pääsy järjestelmiimme.",
      sv: "En före detta anställd som slutade förra veckan har fortfarande aktiva behörigheter till våra system.",
    },
  },
  {
    id: "ransomware",
    icon: "💻",
    signal: "device_issue",
    title: {
      en: "Office PC Ransomware / Malware",
      fi: "Toimiston koneen haittaohjelma",
      sv: "Utpressningsprogram på kontorsdator",
    },
    description: {
      en: "Workstation infected with malicious file encrypting shared drive",
      fi: "Työasemalle ladattu haitallinen liite, joka salaa tiedostoja",
      sv: "Kontorsdator infekterad av skadlig bilaga som krypterar filer",
    },
    text: {
      en: "A workstation opened a malicious attachment and files on the shared network folder started encrypting with a ransom note.",
      fi: "Toimiston tietokone avasi haitallisen liitetiedoston ja verkkolevyn tiedostot alkoivat lukittua lunnasviestillä.",
      sv: "En dator på kontoret öppnade en skadlig bilaga och filer på den delade disken började krypteras.",
    },
  },
];

// What has been said so far.
type Item = { from: "user" | "safestep"; text: string };

const WIDTH = "mx-auto w-full max-w-[640px] px-4";

export function SafeStepApp() {
  const [currentUser, setCurrentUser] = useState<MockUser | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [choice, setChoice] = useState<Language | "auto">("auto");
  const [browserLanguage, setBrowserLanguage] = useState<Language>("fi");
  const [audience, setAudience] = useState<Audience>("consumer");
  const [message, setMessage] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [incident, setIncident] = useState("");
  const [demo, setDemo] = useState<DemoScenario>("none");
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [agent, setAgent] = useState<AgentPreview | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<ApiRequest | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const latest = useRef<HTMLDivElement>(null);
  const options = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      setCurrentUser(user);
      setAudience(user.type);
    }
    const code = navigator.language.slice(0, 2);
    if (code === "en" || code === "sv") setBrowserLanguage(code);
    if (process.env.NODE_ENV === "production") return;
    const name = new URLSearchParams(window.location.search).get("screen");
    const review = name ? demoScreen(name) : null;
    if (review) setResponse(review);
  }, []);

  function handleLoginUser(user: MockUser) {
    setCurrentUser(user);
    setAudience(user.type);
    setStoredUser(user);
    setShowLoginModal(false);
  }

  function handleLogoutUser() {
    setCurrentUser(null);
    setStoredUser(null);
    setShowProfileModal(false);
  }

  const shown = response?.language ?? (choice === "auto" ? browserLanguage : choice);
  const t = translator(shown);
  const consumer = audience === "consumer";
  const question = t(consumer ? "whatHappened" : "whatHappenedBusiness");

  useEffect(() => {
    document.documentElement.lang = shown;
  }, [shown]);

  // Keeps the newest message in view, and moves keyboard and screen reader users to it.
  useEffect(() => {
    latest.current?.scrollIntoView({ block: "end" });
    if (!busy) log.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [items, response, agent, busy]);

  async function send(request: ApiRequest) {
    setBusy(true);
    setFailed(null);
    try {
      setResponse(await client.send(request));
      setAgent(null);
    } catch {
      setFailed(request);
    } finally {
      setBusy(false);
    }
  }

  const record = (...next: Item[]) => setItems((previous) => [...previous, ...next]);

  function reply(recap: string, label: string, request: ApiRequest) {
    record({ from: "safestep", text: recap }, { from: "user", text: label });
    void send(request);
  }

  async function handoff(recap: string, label: string, approved: boolean) {
    record({ from: "safestep", text: recap }, { from: "user", text: label });
    const request: ApiRequest = { kind: "handoff", approved };
    setBusy(true);
    setFailed(null);
    try {
      const next = await client.send(request);
      const preview = approved ? await client.agentView() : null;
      setResponse(next);
      setAgent(preview);
    } catch {
      setFailed(request);
    } finally {
      setBusy(false);
    }
  }

  async function restart() {
    await client.end().catch(() => null);
    setResponse(null);
    setAgent(null);
    setItems([]);
    setClosed(false);
    setFailed(null);
    setMessage("");
    setFollowUp("");
    setIncident("");
    setDemo("none");
    setSelectedScenarioId(null);
  }

  function start() {
    // Masked here as well: the chat must never repeat a code or password the user typed.
    record({ from: "user", text: maskSecrets(message.trim()).text });
    void send({
      kind: "start",
      audience,
      language: choice,
      fallbackLanguage: browserLanguage,
      message: message.trim(),
      ...(incident.trim() ? { incident } : {}),
      ...(demo !== "none" ? { demoScenario: demo } : {}),
    });
  }

  const prototypeLine = <p className="px-4 pb-[max(0.25rem,env(safe-area-inset-bottom))] text-center text-[11px] text-muted-foreground">{t("prototype")}</p>;

  if (items.length === 0 && !response) {
    return (
      <div className="flex h-dvh flex-col">
        <div className="fixed top-[max(0.5rem,env(safe-area-inset-top))] right-3 z-40 flex items-center gap-2">
          {currentUser ? (
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-white/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-xs hover:bg-accent"
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-accent font-bold text-[10px]">
                {currentUser.type === "small_business" ? (
                  <Building2 className="size-3" />
                ) : (
                  <User className="size-3" />
                )}
              </span>
              <span className="max-w-[120px] truncate">{currentUser.name}</span>
              <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {currentUser.type === "small_business" ? "Business" : "Consumer"}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-white/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-xs hover:bg-accent hover:text-foreground"
            >
              <KeyRound className="size-3.5" />
              <span>Log In</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => options.current?.showModal()}
            aria-label={t("options")}
            title={t("options")}
            className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
          >
            <SlidersHorizontal className="size-5" aria-hidden />
          </button>
        </div>
        <main ref={log} className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <StepMark className="size-10 text-foreground" />
          <h1 tabIndex={-1} className="text-2xl font-semibold focus:outline-none">
            {question}
          </h1>
        </main>
        <div className={WIDTH}>
          <DescriptionComposer question={question} sample={t(consumer ? "sample" : "sampleBusiness")} sendLabel={t("send")} text={message} disabled={busy} onChange={setMessage} onSend={start} />

          {/* Quick Scenario Suggestions */}
          <div className="mt-3">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {shown === "fi"
                  ? "Kokeile hyökkäysskenaariota:"
                  : shown === "sv"
                    ? "Testa ett scenario:"
                    : "Try an attack scenario:"}
              </span>
              <button
                type="button"
                onClick={() => options.current?.showModal()}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                <SlidersHorizontal className="size-3" />
                <span>{t("options")}</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(consumer ? RICH_CONSUMER_SCENARIOS : RICH_BUSINESS_SCENARIOS).map((scenario) => {
                const isSelected = selectedScenarioId === scenario.id;
                return (
                  <button
                    key={scenario.id}
                    type="button"
                    onClick={() => {
                      setSelectedScenarioId(scenario.id);
                      setMessage(scenario.text[shown] ?? scenario.text.en);
                      setDemo(scenario.signal);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                      isSelected
                        ? "border-foreground bg-foreground text-background shadow-xs font-semibold"
                        : "border-border-strong bg-card text-foreground hover:border-foreground/30 hover:bg-accent",
                    )}
                  >
                    <span>{scenario.icon}</span>
                    <span>{scenario.title[shown] ?? scenario.title.en}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {prototypeLine}
        <dialog
          ref={options}
          aria-label={t("options")}
          className="m-0 mx-auto mt-auto max-h-[88dvh] w-full max-w-[640px] overflow-y-auto rounded-t-2xl border-t border-border-strong bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-foreground shadow-2xl backdrop:bg-black/40"
        >
          <div className="grid gap-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-accent text-foreground">
                  <SlidersHorizontal className="size-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">{t("options")}</h2>
                  <p className="text-xs text-muted-foreground">
                    {shown === "fi"
                      ? "DNA-verkkoturvan tilannekuva, hyökkäysskenaariot ja asetukset"
                      : shown === "sv"
                        ? "DNA nätverkssäkerhet, attackscenarier och inställningar"
                        : "DNA carrier threat intelligence, attack scenarios & settings"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => options.current?.close()}
                aria-label={t("close")}
                title={t("close")}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            {/* Audience & Language */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <span className="text-xs font-semibold text-foreground">{t("audience")}</span>
                <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-border bg-accent/40 p-1">
                  {(["consumer", "small_business"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setAudience(value);
                        setSelectedScenarioId(null);
                      }}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                        audience === value
                          ? "bg-foreground text-background shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {value === "consumer" ? <User className="size-3.5" /> : <Building2 className="size-3.5" />}
                      <span>{t(value === "consumer" ? "consumer" : "smallBusiness")}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="language" className="text-xs font-semibold text-foreground">
                  {t("language")}
                </label>
                <select
                  id="language"
                  value={choice}
                  onChange={(event) => setChoice(event.target.value as Language | "auto")}
                  className="h-9 w-full rounded-lg border border-border-strong bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="auto">{t("auto")}</option>
                  {LANGUAGES.map(({ code, label }) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* DNA Network Threat Intelligence */}
            <div className="rounded-xl border border-border bg-accent/25 p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Signal className="size-4 text-foreground" />
                  <h3 className="text-xs font-bold text-foreground">{t("demoLabel")}</h3>
                </div>
                <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  DNA Carrier Telemetry
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2.5">
                {shown === "fi"
                  ? "Reaaliaikainen operaattoriverkon havaintotieto (DNS-suojaus, SIM-seuranta, puheluanalyysi)."
                  : shown === "sv"
                    ? "Realtidsinformation från operatörsnätverket (DNS-skydd, SIM-spårning, samtalsanalys)."
                    : "Real-time telecom intelligence from DNA's infrastructure (DNS protection, SIM alerts, call analysis)."}
              </p>
              <select
                id="demo"
                value={demo}
                onChange={(event) => setDemo(event.target.value as DemoScenario)}
                className="h-10 w-full rounded-lg border border-border-strong bg-background px-3 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
              >
                {DEMO_SCENARIOS.map((scenario) => (
                  <option key={scenario} value={scenario}>
                    {t(`demo${scenario}`)}
                  </option>
                ))}
              </select>
            </div>

            {/* Preset Attack Scenarios */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-foreground" />
                  <h3 className="text-xs font-bold text-foreground">{t("examples")}</h3>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {shown === "fi"
                    ? "Valitse skenaario ladataksesi viestin & DNA-signaalin"
                    : shown === "sv"
                      ? "Välj ett scenario för att ladda meddelande & signal"
                      : "Select scenario to load message & DNA signal"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(consumer ? RICH_CONSUMER_SCENARIOS : RICH_BUSINESS_SCENARIOS).map((scenario) => {
                  const isSelected = selectedScenarioId === scenario.id;
                  return (
                    <div
                      key={scenario.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedScenarioId(scenario.id);
                        setMessage(scenario.text[shown] ?? scenario.text.en);
                        setDemo(scenario.signal);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedScenarioId(scenario.id);
                          setMessage(scenario.text[shown] ?? scenario.text.en);
                          setDemo(scenario.signal);
                        }
                      }}
                      className={cn(
                        "flex cursor-pointer flex-col justify-between rounded-xl border p-2.5 text-left transition-all",
                        isSelected
                          ? "border-foreground bg-accent/60 shadow-xs ring-1 ring-foreground/20"
                          : "border-border bg-card hover:border-foreground/30 hover:bg-accent/20",
                      )}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{scenario.icon}</span>
                          <span className="text-xs font-semibold text-foreground">
                            {scenario.title[shown] ?? scenario.title.en}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] text-background">
                            <Check className="size-2.5" />
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                        {scenario.description[shown] ?? scenario.description.en}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-foreground">
                        <span className="size-1.5 rounded-full bg-foreground" />
                        <span className="truncate">{t(`demo${scenario.signal}`)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Attach Suspicious Message / Link */}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="incident" className="text-xs font-semibold text-foreground">
                  {t("pasteToggle")}
                </label>
                {incident.trim() && (
                  <button
                    type="button"
                    onClick={() => setIncident("")}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline"
                  >
                    {shown === "fi" ? "Tyhjennä" : shown === "sv" ? "Rensa" : "Clear"}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {shown === "fi"
                  ? "Liitä epäilyttävä tekstiviesti, sähköpostiviestin teksti tai verkkosivun osoite teknistä skannausta varten."
                  : shown === "sv"
                    ? "Klistra in misstänkt sms, mejltext eller webblänk för teknisk analys."
                    : "Paste raw SMS text, email body, or website link for technical artifact analysis."}
              </p>
              <textarea
                id="incident"
                rows={2}
                maxLength={10000}
                value={incident}
                onChange={(event) => setIncident(event.target.value)}
                placeholder={
                  shown === "fi"
                    ? 'Esim. "DNA: Sinulla on noutamaton paketti. Maksa tulli tästä: https://posti-fi-tulli.com"'
                    : shown === "sv"
                      ? 'T.ex. "DNA: Du har ett outhämtat paket. Betala tull här: https://posti-fi-tulli.com"'
                      : 'e.g. "DNA: You have an unpaid parcel fee. Pay here: https://posti-fi-tulli.com"'
                }
                className="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            {/* Action Bar & Safety Note */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-[11px] text-muted-foreground text-center sm:text-left">
                {t("safetyNote")}
              </p>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Btn
                  variant="plain"
                  className="min-h-9 px-3 text-xs"
                  onClick={() => options.current?.close()}
                >
                  {t("close")}
                </Btn>
                <Btn
                  variant="primary"
                  className="min-h-9 px-4 text-xs font-semibold"
                  onClick={() => {
                    options.current?.close();
                    if (message.trim()) {
                      start();
                    }
                  }}
                >
                  {shown === "fi" ? "Aloita arviointi" : shown === "sv" ? "Starta bedömning" : "Start Assessment"}
                </Btn>
              </div>
            </div>
          </div>
        </dialog>

        {currentUser && (
          <UserProfileModal
            user={currentUser}
            isOpen={showProfileModal}
            onClose={() => setShowProfileModal(false)}
            onSwitchUser={() => {
              setShowProfileModal(false);
              setShowLoginModal(true);
            }}
            onLogout={handleLogoutUser}
          />
        )}

        {showLoginModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
            <LoginPage
              onLoginSuccess={handleLoginUser}
              onBackToApp={() => setShowLoginModal(false)}
            />
          </div>
        )}
      </div>
    );
  }

  const actions = {
    t,
    business: !consumer,
    reply,
    handoff: (recap: string, label: string, approved: boolean) => void handoff(recap, label, approved),
    restart: () => void restart(),
    closed,
    close: (recap: string, label: string) => {
      record({ from: "safestep", text: recap }, { from: "user", text: label });
      setClosed(true);
    },
  };
  const turn = busy || failed || !response ? null : agent ? agentTurn(agent, response.state, actions, () => setAgent(null)) : screenTurn(response, actions);
  const replies: Reply[] = failed
    ? [
        { label: t("tryAgain"), primary: true, run: () => void send(failed) },
        { label: t("startAgain"), run: () => void restart() },
      ]
    : (turn?.replies ?? []);

  return (
    <div className="flex h-dvh flex-col">
      <div className="fixed top-[max(0.5rem,env(safe-area-inset-top))] right-3 z-40 flex items-center gap-2">
        {currentUser ? (
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-white/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-xs hover:bg-accent"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-accent font-bold text-[10px]">
              {currentUser.type === "small_business" ? (
                <Building2 className="size-3" />
              ) : (
                <User className="size-3" />
              )}
            </span>
            <span className="max-w-[110px] truncate">{currentUser.name}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowLoginModal(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-white/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-xs hover:bg-accent hover:text-foreground"
          >
            <KeyRound className="size-3.5" />
            <span>Log In</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => void restart()}
          aria-label={t("exit")}
          title={t("exit")}
          className="flex size-11 items-center justify-center rounded-lg bg-white/90 text-muted-foreground hover:bg-accent"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <main ref={log} role="log" className={cn(WIDTH, "grid gap-4 pt-14 pb-4")}>
          {items.map((item, index) =>
            item.from === "user" ? (
              <p key={index} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2 leading-relaxed">
                {item.text}
              </p>
            ) : (
              <p key={index} className="max-w-[92%] text-muted-foreground">
                {item.text}
              </p>
            ),
          )}
          {response?.secretWarning && <SecretNote text={response.secretWarning} />}
          {turn && (
            <div className="grid gap-2.5 leading-relaxed">
              <StepMark className="size-5 text-foreground" />
              {turn.body}
            </div>
          )}
          {failed && (
            <h1 tabIndex={-1} className="font-medium focus:outline-none">
              {t("failed")}
            </h1>
          )}
          {busy && (
            <div role="status" aria-label={t("loading")} className="flex gap-1 py-2">
              {[0, 150, 300].map((delay) => (
                <span key={delay} className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${delay}ms` }} />
              ))}
            </div>
          )}
          <div ref={latest} />
        </main>
      </div>

      {response?.screen.type === "describe" && (
        <div className={WIDTH}>
          <DescriptionComposer
            question=""
            sample={t("typeAnswerOrDetails")}
            sendLabel={t("send")}
            text={followUp}
            disabled={busy}
            onChange={setFollowUp}
            onSend={() => {
              if (!followUp.trim()) return;
              const text = followUp.trim();
              setFollowUp("");
              record({ from: "user", text: maskSecrets(text).text });
              void send({ kind: "add_details", text });
            }}
          />
        </div>
      )}

      {response?.screen.type === "end" && (
        <div className={WIDTH}>
          <DescriptionComposer
            question=""
            sample={t("askFollowUp")}
            sendLabel={t("send")}
            text={followUp}
            disabled={busy}
            onChange={setFollowUp}
            onSend={() => {
              if (!followUp.trim()) return;
              const text = followUp.trim();
              setFollowUp("");
              setMessage(text);
              record({ from: "user", text: maskSecrets(text).text });
              // A new case in the same chat: earlier messages stay on screen.
              void send({ kind: "start", audience, language: choice, fallbackLanguage: browserLanguage, message: text });
            }}
          />
        </div>
      )}

      {response?.screen.type === "result" && (
        <div className={WIDTH}>
          <DescriptionComposer
            question=""
            sample={t("askFollowUp")}
            sendLabel={t("send")}
            text={followUp}
            disabled={busy}
            onChange={setFollowUp}
            onSend={() => {
              if (!followUp.trim()) return;
              const text = followUp.trim();
              setFollowUp("");
              record({ from: "user", text: maskSecrets(text).text });
              // Added to the same session, so earlier answers and progress are kept.
              void send({ kind: "add_details", text });
            }}
          />
        </div>
      )}

      {response?.screen.type === "flip" && (() => {
        const flipScreen = response.screen;
        return (
          <div className={WIDTH}>
            <DescriptionComposer
              question=""
              sample={t("typeAnswerOrDetails")}
              sendLabel={t("send")}
              text={followUp}
              disabled={busy}
              onChange={setFollowUp}
              onSend={() => {
                if (!followUp.trim()) return;
                const text = followUp.trim();
                setFollowUp("");
                // The server reads the whole reply, so details beyond yes or no aren't lost.
                reply(flipScreen.question, maskSecrets(text).text, {
                  kind: "answer_text",
                  topic: flipScreen.topic,
                  text,
                });
              }}
            />
          </div>
        );
      })()}

      {replies.length > 0 && (
        <div className={cn(WIDTH, "flex flex-wrap gap-2 pt-1 pb-2")}>
          {replies.map((option) => (
            <Btn key={option.label} variant={option.primary ? "primary" : "plain"} disabled={busy} onClick={option.run} className="min-w-[45%] flex-1">
              {option.label}
            </Btn>
          ))}
        </div>
      )}

      {currentUser && (
        <UserProfileModal
          user={currentUser}
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          onSwitchUser={() => {
            setShowProfileModal(false);
            setShowLoginModal(true);
          }}
          onLogout={handleLogoutUser}
        />
      )}

      {showLoginModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
          <LoginPage
            onLoginSuccess={handleLoginUser}
            onBackToApp={() => setShowLoginModal(false)}
          />
        </div>
      )}

      {prototypeLine}
    </div>
  );
}
