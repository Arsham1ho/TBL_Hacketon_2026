"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  History,
  Landmark,
  Monitor,
  Moon,
  Smartphone,
  Sun,
  Trash,
  Building2,
  KeyRound,
  SlidersHorizontal,
  User,
  X,
} from "lucide-react";
import { type DemoScenario } from "@/adapters/signals";
import { maskSecrets } from "@/engine/input-guard";
import type { ApiRequest, ApiResponse } from "@/engine/screens";
import type { Audience, Language } from "@/engine/types";
import { client, type AgentPreview } from "@/lib/client";
import { getStoredUser, setStoredUser, type MockUser } from "@/lib/mock-users";
import { translator } from "@/lib/ui-text";
import { DEFAULT_PREFERENCES, loadPreferences, motionReduced, savePreferences, type Preferences } from "@/lib/preferences";
import { BANKS, OPERATORS, type Provider } from "@/lib/providers";
import { cn } from "@/lib/utils";
import { nextSample, sampleText } from "@/lib/samples";
import { demoScreen } from "@/mocks/journey";
import { DescriptionComposer } from "./composer";
import { LoginPage } from "./login-page";
import { AssessmentNote, agentTurn, screenTurn, type Reply } from "./turns";
import { guessProvider, type ProviderChoice, type ProviderKind } from "@/lib/providers";
import { Btn, SecretNote, StepMark } from "./ui";
import { UserProfileModal } from "./user-profile-modal";
import { VoiceMode } from "./voice-mode";
import { ProviderLogo, SelectMenu } from "./select-menu";
import { HistoryPanel } from "./history-panel";
import { clearHistory, newConversationId, saveConversation } from "@/lib/history";

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
type Item = { from: "user" | "safestep"; text: string; assessment?: ApiResponse["state"] };

const SettingsGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="grid gap-1">
    <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
    <div className="grid divide-y divide-border rounded-2xl border border-border">{children}</div>
  </section>
);

// A label on the left and its control on the right, stacking on narrow screens.
const SettingRow = ({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5">
    <span className="flex items-center gap-2 text-sm font-medium">
      {icon}
      {label}
    </span>
    <div className="w-full sm:w-auto sm:min-w-[260px]">{children}</div>
  </div>
);

// The bank or operator, picked from a list with each provider's official logo.
function ProviderSelect({ id, label, kind, value, options, notSet, other, onChange }: { id: string; label: string; kind: "bank" | "operator"; value?: string; options: Provider[]; notSet: string; other: string; onChange: (id: string) => void }) {
  const generic = kind === "bank" ? <Landmark className="size-4" aria-hidden /> : <Smartphone className="size-4" aria-hidden />;
  return (
    <SelectMenu
      id={id}
      label={label}
      value={value}
      placeholder={notSet}
      placeholderIcon={generic}
      onChange={onChange}
      options={[...options.map((option) => ({ value: option.id, label: option.name, icon: <ProviderLogo src={option.logo} /> })), { value: "other", label: other }]}
    />
  );
}

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string; icon?: React.ReactNode }[]; onChange: (value: string) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-full bg-accent p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-all",
            value === option.value ? "bg-card text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

const WIDTH = "mx-auto w-full max-w-[640px] px-4";

export function SafeStepApp() {
  const [currentUser, setCurrentUser] = useState<MockUser | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [voice, setVoice] = useState(false);
  // Which example the empty field shows. Picked at random after load, then rotated.
  const [sample, setSample] = useState(0);
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
  // This chat's place in the browser history. A new id each time the user starts over.
  const [historyOpen, setHistoryOpen] = useState(false);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);
  const conversation = useRef<{ id: string; startedAt: number } | null>(null);
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<ApiRequest | null>(null);
  const [stage, setStage] = useState(0);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<("why" | "details")[]>([]);
  const [providers, setProviders] = useState<ProviderChoice>({});
  const lastStatus = useRef<string | null>(null);
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

  // A random example each visit, and a new one every few seconds while the field is empty.
  useEffect(() => setSample(nextSample(Math.floor(Math.random() * 10))), []);
  useEffect(() => {
    if (message || response || motionReduced()) return;
    const timer = setInterval(() => setSample(nextSample), 4500);
    return () => clearInterval(timer);
  }, [message, response]);
  const t = translator(shown);
  const consumer = audience === "consumer";
  const question = t(consumer ? "whatHappened" : "whatHappenedBusiness");

  useEffect(() => {
    document.documentElement.lang = shown;
  }, [shown]);

  // Keeps the newest message in view, and moves keyboard and screen reader users to it.
  // Also follows each new card of a result. Waits a frame so the new content is laid out first.
  useEffect(() => {
    const reduced = motionReduced();
    const frame = requestAnimationFrame(() => latest.current?.scrollIntoView({ block: "end", behavior: reduced ? "auto" : "smooth" }));
    if (!busy) log.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    return () => cancelAnimationFrame(frame);
  }, [items, response, agent, busy, stage, revealed]);

  // Each chat is saved in this browser as it goes, so it can be read again from History.
  useEffect(() => {
    if (items.length === 0) return;
    conversation.current ??= { id: newConversationId(), startedAt: Date.now() };
    const first = items.find((item) => item.from === "user" && !item.assessment);
    saveConversation({
      ...conversation.current,
      updatedAt: Date.now(),
      audience,
      language: shown,
      title: (first?.text ?? "").slice(0, 120) || t("history"),
      items,
      status: response?.state.status,
      statusLabel: response?.state.statusLabel,
      likelyType: response?.state.likelyType,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, response]);

  // Remembered on this device, or taken from the logged-in profile.
  useEffect(() => {
    let saved: ProviderChoice = {};
    try {
      saved = JSON.parse(localStorage.getItem("safestep-providers") ?? "{}");
    } catch {}
    setProviders({
      bank: saved.bank ?? guessProvider("bank", currentUser?.business?.corporateBank ?? currentUser?.personal.primaryBank),
      operator: saved.operator ?? guessProvider("operator", currentUser?.personal.operatorSubscription),
    });
  }, [currentUser]);

  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  useEffect(() => setPreferences(loadPreferences()), []);
  function updatePreferences(change: Partial<Preferences>) {
    const next = { ...preferences, ...change };
    setPreferences(next);
    savePreferences(next);
  }

  // Forgets everything this device remembers: preferences, providers and the demo login.
  function clearSaved() {
    try {
      ["safestep-providers", "safestep-preferences", "safestep_active_user_id"].forEach((key) => localStorage.removeItem(key));
    } catch {}
    clearHistory();
    setProviders({});
    setPreferences(DEFAULT_PREFERENCES);
    savePreferences(DEFAULT_PREFERENCES);
    try {
      localStorage.removeItem("safestep-preferences");
    } catch {}
    handleLogoutUser();
  }

  function choose(kind: ProviderKind, id: string) {
    const next = { ...providers, [kind]: id };
    setProviders(next);
    try {
      localStorage.setItem("safestep-providers", JSON.stringify(next));
    } catch {}
  }

  // A new answer from SafeStep starts its result from the first card. Each time the AI's
  // assessment changes, it's shown in the chat before the conversation carries on.
  function arrived(next: ApiResponse) {
    setStage(0);
    setRevealed([]);
    setConfirmed([]);
    const status = next.state?.status;
    // A result has its own summary card with the same gauge, so no note there.
    if (status && status !== lastStatus.current && (status !== "needs_verification" || lastStatus.current) && next.screen.type !== "result") {
      setItems((previous) => [...previous, { from: "safestep", text: next.state.statusLabel ?? status, assessment: next.state }]);
    }
    lastStatus.current = status ?? lastStatus.current;
    setResponse(next);
  }

  async function send(request: ApiRequest) {
    setBusy(true);
    setFailed(null);
    try {
      arrived(await client.send(request));
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
      arrived(next);
      setAgent(preview);
    } catch {
      setFailed(request);
    } finally {
      setBusy(false);
    }
  }

  async function restart() {
    conversation.current = null;
    await client.end().catch(() => null);
    setResponse(null);
    setAgent(null);
    setItems([]);
    lastStatus.current = null;
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

  const historyButton = (
    <>
      <button
        type="button"
        onClick={() => setHistoryOpen(true)}
        aria-label={t("history")}
        title={t("history")}
        className="fixed top-[max(0.5rem,env(safe-area-inset-top))] left-3 z-40 flex size-11 items-center justify-center rounded-lg bg-card/90 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <History className="size-5" aria-hidden />
      </button>
      <HistoryPanel open={historyOpen} onClose={closeHistory} t={t} language={shown} />
    </>
  );

  const prototypeLine = <p className="px-4 pb-[max(0.25rem,env(safe-area-inset-bottom))] text-center text-[11px] text-muted-foreground">{t("prototype")}</p>;

  if (items.length === 0 && !response) {
    return (
      <div className="flex h-dvh flex-col">
        {historyButton}
        <div className="fixed top-[max(0.5rem,env(safe-area-inset-top))] right-3 z-40 flex items-center gap-2">
          {currentUser ? (
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-card/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-xs hover:bg-accent"
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
              className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-card/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-xs hover:bg-accent hover:text-foreground"
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
        {voice && <VoiceMode audience={audience} choice={choice} fallbackLanguage={browserLanguage} onClose={() => setVoice(false)} />}
        <div className={WIDTH}>
          <DescriptionComposer question={question} sample={sampleText(audience, sample, shown)} sendLabel={t("send")} text={message} disabled={busy} onChange={setMessage} onSend={start} voiceLabel={t("talkByVoice")} onVoice={() => setVoice(true)} />

        </div>
        {prototypeLine}
        <dialog
          ref={options}
          aria-label={t("options")}
          className="m-0 mx-auto mt-auto max-h-[88dvh] w-full max-w-[640px] overflow-y-auto rounded-t-2xl border-t border-border-strong bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-foreground shadow-2xl backdrop:bg-black/40"
        >
          <div className="grid gap-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2.5 text-base font-bold tracking-tight">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent">
                  <SlidersHorizontal className="size-4" aria-hidden />
                </span>
                {t("options")}
              </h2>
              <button
                type="button"
                onClick={() => options.current?.close()}
                aria-label={t("close")}
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <SettingsGroup title={t("settingsYou")}>
              <SettingRow label={t("audience")}>
                <Segmented
                  label={t("audience")}
                  value={audience}
                  options={[
                    { value: "consumer", label: t("consumer"), icon: <User className="size-3.5" aria-hidden /> },
                    { value: "small_business", label: t("smallBusiness"), icon: <Building2 className="size-3.5" aria-hidden /> },
                  ]}
                  onChange={(value) => {
                    setAudience(value as Audience);
                    setSelectedScenarioId(null);
                  }}
                />
              </SettingRow>
              <SettingRow label={t("language")}>
                <Segmented
                  label={t("language")}
                  value={choice}
                  options={[{ value: "auto", label: t("auto") }, ...LANGUAGES.map(({ code }) => ({ value: code, label: code.toUpperCase() }))]}
                  onChange={(value) => setChoice(value as Language | "auto")}
                />
              </SettingRow>
            </SettingsGroup>

            <SettingsGroup title={t("settingsAppearance")}>
              <SettingRow label={t("theme")}>
                <Segmented
                  label={t("theme")}
                  value={preferences.theme}
                  options={[
                    { value: "system", label: t("themeSystem"), icon: <Monitor className="size-3.5" aria-hidden /> },
                    { value: "light", label: t("themeLight"), icon: <Sun className="size-3.5" aria-hidden /> },
                    { value: "dark", label: t("themeDark"), icon: <Moon className="size-3.5" aria-hidden /> },
                  ]}
                  onChange={(value) => updatePreferences({ theme: value as Preferences["theme"] })}
                />
              </SettingRow>
              <SettingRow label={t("textSize")}>
                <Segmented
                  label={t("textSize")}
                  value={preferences.text}
                  options={[
                    { value: "normal", label: "A" },
                    { value: "large", label: "A+" },
                  ]}
                  onChange={(value) => updatePreferences({ text: value as Preferences["text"] })}
                />
              </SettingRow>
              <SettingRow label={t("animations")}>
                <Segmented
                  label={t("animations")}
                  value={preferences.motion}
                  options={[
                    { value: "on", label: t("on") },
                    { value: "off", label: t("off") },
                  ]}
                  onChange={(value) => updatePreferences({ motion: value as Preferences["motion"] })}
                />
              </SettingRow>
            </SettingsGroup>

            {/* Used to show the right contact when something happens. */}
            <SettingsGroup title={t("settingsServices")}>
              <SettingRow label={t("yourBank")} icon={<Landmark className="size-4" aria-hidden />}>
                <ProviderSelect id="bank" kind="bank" label={t("yourBank")} value={providers.bank} options={BANKS} notSet={t("notSet")} other={t("otherProvider")} onChange={(id) => choose("bank", id)} />
              </SettingRow>
              <SettingRow label={t("yourOperator")} icon={<Smartphone className="size-4" aria-hidden />}>
                <ProviderSelect id="operator" kind="operator" label={t("yourOperator")} value={providers.operator} options={OPERATORS} notSet={t("notSet")} other={t("otherProvider")} onChange={(id) => choose("operator", id)} />
              </SettingRow>
            </SettingsGroup>

            <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={clearSaved}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-destructive hover:bg-danger-soft"
              >
                <Trash className="size-4" aria-hidden />
                {t("clearData")}
              </button>
              <Btn variant="primary" className="min-h-10 px-5 text-sm" onClick={() => options.current?.close()}>
                {t("done")}
              </Btn>
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
    stage,
    confirmed,
    advance: (recap: string, label: string) => {
      record({ from: "safestep", text: recap }, { from: "user", text: label });
      if (label === t("done")) setConfirmed((steps) => [...steps, recap]);
      setStage((value) => value + 1);
    },
    revealed,
    reveal: (part: "why" | "details") => setRevealed((value) => [...value, part]),
    providers,
    choose,
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
      {historyButton}
        <div className="fixed top-[max(0.5rem,env(safe-area-inset-top))] right-3 z-40 flex items-center gap-2">
        {currentUser ? (
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-card/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-xs hover:bg-accent"
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
            className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-card/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-xs hover:bg-accent hover:text-foreground"
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
          className="flex size-11 items-center justify-center rounded-lg bg-card/90 text-muted-foreground hover:bg-accent"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <main ref={log} role="log" className={cn(WIDTH, "grid gap-4 pt-14 pb-4")}>
          {items.map((item, index) =>
            item.assessment ? (
              <AssessmentNote key={index} state={item.assessment} t={t} />
            ) : item.from === "user" ? (
              <p key={index} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2 leading-relaxed">
                {item.text}
              </p>
            ) : (
              // Earlier SafeStep steps, as a compact timeline.
              <p key={index} className="flex max-w-[92%] items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-border-strong" aria-hidden />
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

      {response?.screen.type === "ask" && (() => {
        const askScreen = response.screen;
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
                reply(askScreen.question, maskSecrets(text).text, { kind: "ai_answer", id: askScreen.id, text });
              }}
            />
          </div>
        );
      })()}

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
            <Btn key={option.label} variant="primary" disabled={busy} onClick={option.run} className="min-w-[45%] flex-1 gap-2">
              {option.icon}
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
