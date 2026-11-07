import type { Facts, IncidentType, Language } from "./types";

// Deterministic fact reader for Finnish, English and Swedish. It needs no LLM, so it
// also backs the app when the LLM is down. It reports only what its patterns can
// quote, and leaves the rest unknown.

export type ExtractionInput = {
  userText: string;
  incidentText: string;
  language: Language;
  incidentChannel: string | null;
  // A link that isn't confirmed clean. A clean result is still not proof of safety.
  hasRiskyLink: boolean;
};

// Many users skip ä, ö and å, so patterns and text are both folded before matching.
export const fold = (text: string) =>
  text.replace(/[äÄåÅ]/gu, "a").replace(/[öÖ]/gu, "o");

const re = (source: string) => new RegExp(fold(source), "iu");

const INCIDENT_PATTERNS: [IncidentType, RegExp][] = [
  ["partner_monitoring", re(String.raw`\b(my ex|ex-?partner|former partner|exäni|ex-?kumppan|ex-?mie|ex-?vaimo|entinen (puoliso|mies|vaimo|kumppani)|min ex|mitt ex|min före detta)\b`)],
  ["ransomware", re(String.raw`ransom|lunnas|lösen(summa|pengar|krav)|bitcoin|\bbtc\b|won't open|encrypted|eivät aukea|ei aukea|salattu|salattiin|går inte att öppna|krypterad\w* filer|filerna .{0,20}krypter`)],
  ["mailbox_takeover", re(String.raw`forwarding rule|edelleenlähetyssään|vidarebefordringsregel|wrong account number|väärä tilinumero|väärällä tilinumerolla|fel kontonummer`)],
  ["former_staff_access", re(String.raw`(left|former|ex-?employee|lähti|lähtenyt|entinen|slutade|slutat|tidigare).{0,40}(employee|staff|logged in|työntekijä|kirjaut|anställd|inloggad)|(employee|työntekijä|anställd).{0,30}(left|lähti|lähtenyt|slutade|slutat)`)],
  ["sim_or_number_change", re(String.raw`e-?sim.{0,60}(activ|aktiv|uud|new|ny)|(activ|aktivoi|aktiver).{0,40}e-?sim|number transfer|number is being (moved|transferred)|numero(n)?siirto|numeron siirto|numero\w* siirr|nummerflytt|numret flyttas|(lost|no) signal|kenttä|ei kenttää|ingen täckning|tappade täckning`)],
  ["unexpected_order_or_bill", re(String.raw`order confirmation|tilausvahvistus|orderbekräftelse|beställningsbekräftelse`)],
  ["approval_prompts", re(String.raw`approval (request|prompt)|login approval|approve|hyväksymispyyn|hyväksy(n|t)|kirjautumispyyn|godkänn|inloggningsbegär`)],
  ["unknown_login", re(String.raw`logged in from|kirjauduttu|kirjauduttiin|kirjautuminen .{0,20}(maasta|espanja|ulkomail)|sisäänkirjautum|inloggning från|inloggad från`)],
  ["data_breach_notice", re(String.raw`breach|data leak|leaked|tietovuo|tietomur|vuoti|vuotanut|vuotaneet|dataintrång|dataläcka|läckt`)],
  ["unrequested_reset", re(String.raw`password reset|reset (email|link)|salasanan (nollaus|vaihto|palautus)|nollauspyyn|återställ.{0,12}lösenord|lösenordsåterställ`)],
  ["router_or_network", re(String.raw`router|reititin|reitittim|modeemi`)],
  ["payment_detail_change", re(String.raw`(bank account|account number|tilinumero|pankkitili|kontonummer|bankkonto).{0,60}(chang|new|muuttu|uusi|uuteen|uudelle|ändr|nytt)|(new|uusi|uudelle|nytt|changed).{0,30}(bank account|account number|tilinumero|bankkonto|kontonummer)|uudelle tilille|new account`)],
  ["payment_request", re(String.raw`\b(ceo|toimitusjohtaj\w*|pomo\w*|boss|chef\w*|vd:?n?|managing director)\b`)],
  ["ransomware", re(String.raw`(screen|näyttö|skärm).{0,30}(demand|vaati|kräv)`)],
  ["remote_session", re(String.raw`remote (support|access|session|program)|etäy|etätuki|etäyhteys|fjärr`)],
  ["unwanted_app_or_profile", re(String.raw`\b(installed|asensin|installerade)\b|\.apk|profile|profiili|certificate|sertifikaat|certifikat`)],
  ["missed_call", re(String.raw`missed call|one ring|rang once|rang only once|puuttuva puhelu|soi (vain )?kerran|missat samtal|ringde en gång`)],
  ["phone_call", re(String.raw`\b(called|call|caller|phone call|rang|ringde|samtal|soitti|soittaja|puhelu)\b|^\(call\)|^\(puhelu\)`)],
  ["link_or_site", re(String.raw`\b(clicked|opened the link|avasin linkin|klikkasin|klickade|öppnade länken)\b`)],
];

const POSES: [NonNullable<Facts["pretendsToBe"]>, RegExp][] = [
  ["police", re(String.raw`\b(police|poliisi\w*|polis\w*)\b`)],
  ["bank", re(String.raw`\b(bank|bank's|pankki\w*|pankin|pankista|bankid|verkkopank\w*|banken|banken?s)\b|[\p{L}]+pankki|[\p{L}]+pankin|verkkopank|bank identification|pankkitunnu`)],
  ["operator", re(String.raw`operator|operaattor|operatör|subscription|liittymä|abonnemang|sim upgrade|sim-|e-?sim`)],
  ["family", re(String.raw`my (child|son|daughter|mother|mum|dad|grandchild|grandson|granddaughter)|claiming to be my|lapse|tyttäre|poika|äiti|isä|lapsenlaps|barn|dotter|mamma|pappa|barnbarn|new number|uusi numero|uudesta numerosta|nytt nummer`)],
  ["ceo", re(String.raw`\b(ceo|toimitusjohtaj\w*|pomo\w*|boss|chef\w*|vd)\b`)],
  ["supplier", re(String.raw`supplier|toimittaja|leverantör`)],
  ["authority", re(String.raw`tax (office|refund)|vero|skatteverket|skatte|authority|viranomai|myndighet`)],
  ["support", re(String.raw`support|tuki|asiakaspalvelu|tech support|microsoft|kundtjänst|delivery|parcel|paketti|paket|streaming|tullissa|customs`)],
];

const ASKS: [Facts["asksFor"][number], RegExp][] = [
  ["remote_access", re(String.raw`remote (access|support|program)|etäyhteyd|etätu|fjärr(åtkomst|hjälp|stöd)|anydesk|teamviewer`)],
  ["app_install", re(String.raw`install|asenna|asentamaan|installera`)],
  ["code", re(String.raw`(?<!qr[ -])\bcodes?\b|(?<!qr-)koodi|tunnuslu|\bpin\b|(?<!qr-)\bkod(en|er)?\b`)],
  ["login", re(String.raw`\blog ?in\b|logging in|sign in|credentials|kirjaudu|kirjautu|tunnistau|tunnukse|logga in|inloggning|identify|identifying|verify your account|confirm my details|vahvista tieto|bekräfta`)],
  ["card", re(String.raw`card (details|number)|update your card|update my card|kortti|korttitie|kortuppgift|kortnummer`)],
  ["money", re(String.raw`\bpay\b|payment of|fee|\bmaksa\w*|\bmaksu\b|käsittelymaksu|toimitusmaksu|betala|avgift|send money|lähetä rahaa|skicka pengar|move .{0,20}money|siirrä rahat|invest|sijoit|investera|returns guaranteed|tuotto|avkastning|trading|(needs?|wants?|asks? for|pyysi|pyytää|haluaa|vill ha|behöver)\s.{0,12}\d|bail\b`)],
  ["bank_change", re(String.raw`(new|changed).{0,20}(bank account|account number)|tilinumero|bankkonto`)],
];

const NOTHING_DONE = re(String.raw`hung up|i did(n't| not) (do|click|open|pay|give|type|enter)|haven't (done|clicked|opened|paid)|nothing yet|löin luurin|lopetin puhelun|en (tehnyt|klikannut|avannut|maksanut|antanut)|lade på|gjorde inget|har inte (klickat|öppnat|betalat)|inte klickat`);

// Covers "I didn't type it" and "they asked me to type it", which are not actions taken.
const NEGATED = re(String.raw`\b(didn't|did not|haven't|have not|never|asked (me )?to|wants? me to|told me to|en |et |emme |inte |aldrig |pyysi|pyytää|bad mig)`);
const NEGATED_OBJECT = re(String.raw`\b(typed|entered|gave|installed|opened|paid)\s+(no|not|nothing)\b`);

const ATTACHMENT = re(String.raw`attachment|\.zip|\.docm|liite|liitteen|bilaga`);

const DID: [Facts["userAlreadyDid"][number], RegExp][] = [
  ["gave_remote_access", re(String.raw`(installed|gave|let).{0,50}(remote|control)|they controlled|remote support program|etä(tuki|ohjelma|yhtey).{0,40}(asensin|annoin)|(asensin|annoin).{0,50}etä|ohjasi(vat)? (konetta|tietokonetta|puhelinta)|installerade.{0,40}fjärr|fjärr.{0,40}installerade|styrde (datorn|min)`)],
  ["installed_app", re(String.raw`i installed|i downloaded|asensin|latasin sovelluksen|installerade|laddade ner appen`)],
  ["opened_attachment", re(String.raw`opened (it|the attachment|the zip)|i opened .{0,30}(attachment|zip|file)|avasin (sen|liitteen|tiedoston)|öppnade (den|bilagan|filen)`)],
  ["entered_card", re(String.raw`(typed|entered|gave|put in|filled in).{0,30}card|card (details|number).{0,20}(typed|entered)|(syötin|annoin|kirjoitin|täytin).{0,30}kort|(skrev|angav|fyllde|lämnade).{0,30}kort`)],
  ["paid", re(String.raw`emptied|stole|stolen|tyhjen|tyhjä|varastettiin|varastivat|tömd|tömde|stulit|i (already )?(paid|moved|transferred|sent)( the| it| money|\b)|already (moved|paid|sent)|payment (has )?(went|gone|was sent)|(maksoin|siirsin|lähetin rahat|lähetin rahaa)|olen (jo )?(maksanut|siirtänyt)|(betalade|flyttade|förde över|skickade pengar)|har (redan )?(betalat|flyttat)`)],
  ["shared_code", re(String.raw`(typed|gave|read out|entered|shared).{0,40}(code|pin)|code .{0,20}(typed|gave|read)|(annoin|luin|syötin|kirjoitin|kerroin).{0,50}(koodi|tunnuslu)|(gav|läste upp|skrev|angav).{0,30}(kod|pin)`)],
  ["entered_login", re(String.raw`(typed|entered|signed in|logged in|gave).{0,40}(password|credentials|work email|login|through a link)|logged in through|signed in with|(syötin|annoin|kirjoitin|kirjauduin).{0,40}(salasan|tunnuks|linkin|linkistä|sähköposti)|kirjauduin|(työntekijä\w*|employee).{0,20}(kirjautui|signed in)|(skrev|angav|loggade in).{0,40}(lösenord|inloggning|länk)|loggade in`)],
  ["opened_link", re(String.raw`(clicked|opened|tapped|followed).{0,40}link|link .{0,20}(clicked|opened)|(avasin|klikkasin|painoin|napautin).{0,40}(linkki|linkin)|linkin.{0,20}(avasin|klikkasin)|(klickade|öppnade|tryckte).{0,30}länk`)],
];

const SELF_YES = re(String.raw`i('m| am) (logging|signing) in|right now on|new (laptop|computer)|i ordered|we booked|we ordered|i booked|booked .{0,30}(partner|support)|tiketin tein itse|i made the ticket|tilasin|tilasimme|olen kirjautumassa|olen ottamassa|uutta tietokonetta|kirjaudun juuri|lisäsin|i added|jag lade till|jag beställde|vi beställde|vi bokade|jag loggar in|ny dator|i own|my own`);
const SELF_NO = re(String.raw`(didn't|did not|not) (ask|request|start|initiate|log|logging|sign|order)|i'm not logging|en ole kirjautu|en pyytänyt|en ole pyytänyt|en aloittanut|en tilannut|ei tilattu|har inte (bett|begärt|startat|beställt)|bad inte|loggar inte in`);
const VERIFIED = re(String.raw`(called|phoned|rang).{0,60}(number in our contract|known number|confirmed)|she confirmed|he confirmed|soitin.{0,50}(sopimuksen|tuttuun|vahvisti)|soittamalla.{0,50}tuttuun|vahvisti muutoksen|ringde.{0,50}(avtalet|bekräftade|känt)|genom att ringa|bekräftade ändringen|\((admin|pääkäyttäjä|administratör)\)`);

const PRESSURE = re(String.raw`urgent|immediately|within \d+|today|keep it (confidential|secret)|confidential|suspended|expire|expiring|locked|overdue|kiire|välittömästi|heti|tunnin sisällä|luottamuksellis|lukittu|erääntyy|vanhenee|suljetaan|tänään|bråttom|omedelbart|inom \d+|hemlig|konfidentiell|spärrad|löper ut|stängs|i dag|virus|don't remember|en muista|minns inte|same thread|samma tråd|samassa ketjussa`);
const LIVE = re(String.raw`still on the (phone|line)|on the (phone|line) (now|right now)|calling (me )?(right )?now|right now|juuri nyt|on (vielä )?linjalla|puhelu on käynnissä|just nu|fortfarande i (telefon|luren)|på linjen`);
const TRACE = re(String.raw`who owns|find out who|find (me )?(this|the) scammer|scammer's (address|name)|expose|publish (their|his|her) name|kuka omistaa|selvittää kuka|selvitä kuka|paljasta|julkaista|etsi .{0,30}huijari|huijarin (osoite|nimi)|vem som äger|ta reda på vem|hitta bedragaren|bedragarens (adress|namn)|hänga ut|publicera`);

const EMAIL_ONLY = re(String.raw`only my email|only (an |your )?email|names and email|no passwords|vain sähköposti|ei salasanoja|nimet ja sähköposti|endast e-post|bara (min )?e-post|inga lösenord`);
const PASSWORD_LEAK = re(String.raw`passwords?|salasan|lösenord`);
const BANK_LOGIN = re(String.raw`bank credentials|online bank|verkkopankki|pankkitunnu|internetbank|bank-?id`);
const REUSED = re(String.raw`same password|samaa salasanaa|samma lösenord`);
const SERVICE_LOST = re(String.raw`lost signal|no signal|ei kenttää|kenttä|ingen täckning|tappade täckning`);
const STRANGER = re(String.raw`unknown number|someone called|tuntemat|joku soitti|okänt nummer|någon ringde`);

function first(pattern: RegExp, text: string): string | null {
  const match = pattern.exec(text);
  return match ? match[0] : null;
}

// Genuine notices send you to your own app and ask for nothing here.
const OWN_CHANNEL = re(String.raw`in the app|in your online|as usual|contains no links|no links|sovelluksessa|sovelluksesta|verkkopankkiin|verkkopalvelussa|oma-|omassa|i appen|i din|som vanligt|inga länkar|ei sisällä linkkejä|ei ole linkkiä|automaatti`);
const ASKED_NOTHING = re(String.raw`asked for nothing|asked for no details|no details|ei pyytänyt mitään|ei kysynyt mitään|ei pyytänyt tietoja|bad inte om något|bad inte om några`);

export function offlineExtract(input: ExtractionInput): Facts {
  const { language, incidentChannel, hasRiskyLink } = input;
  const userText = fold(input.userText);
  const incidentText = fold(input.incidentText);
  const all = `${userText}\n${incidentText}`;
  const evidence: Facts["evidence"] = [];
  const quote = (fact: string, text: string) => evidence.push({ fact, quote: text });

  const pick = <T>(table: [T, RegExp][], text: string, field: string): T | null => {
    for (const [value, pattern] of table) {
      const found = first(pattern, text);
      if (found) {
        quote(field, found);
        return value;
      }
    }
    return null;
  };
  const collect = <T>(table: [T, RegExp][], text: string, field: string): T[] => {
    const values: T[] = [];
    for (const [value, pattern] of table) {
      const found = first(pattern, text);
      if (found) {
        quote(field, found);
        values.push(value);
      }
    }
    return values;
  };
  const flag = (pattern: RegExp, text: string, field: string): boolean | null => {
    const found = first(pattern, text);
    if (!found) return null;
    quote(field, found);
    return true;
  };

  const did = collect(DID, userText, "userAlreadyDid").filter((action) => {
    // "I didn't type my card" must not read as "I typed my card".
    const pattern = DID.find(([value]) => value === action)![1];
    const start = pattern.exec(userText)?.index ?? 0;
    const match = pattern.exec(userText);
    return !NEGATED.test(userText.slice(Math.max(0, start - 16), start + 3))
      && !NEGATED_OBJECT.test(match?.[0] ?? "");
  });
  const nothing = first(NOTHING_DONE, userText);
  if (nothing && did.length === 0) {
    did.push("nothing");
    quote("userAlreadyDid", nothing);
  }

  const selfNo = first(SELF_NO, userText);
  const selfYes = first(SELF_YES, userText);
  let selfInitiated: Facts["selfInitiated"] = null;
  if (selfNo) {
    selfInitiated = "no";
    quote("selfInitiated", selfNo);
  } else if (selfYes) {
    selfInitiated = "yes";
    quote("selfInitiated", selfYes);
  }

  // The attachment must come from the user's story: a scam text mentioning one proves nothing.
  const attachment = first(ATTACHMENT, userText);
  const specific = pick(INCIDENT_PATTERNS, all, "incidentType") ?? (attachment ? "suspicious_attachment" : null);
  if (specific === "suspicious_attachment" && attachment) quote("incidentType", attachment);
  const callChannel = incidentChannel === "call" && specific !== "missed_call" && (specific === null || GENERAL_TYPES.includes(specific));
  const incidentType = callChannel ? "phone_call" : specific ?? fallbackType(incidentText, userText, quote);
  if (callChannel) quote("incidentType", (incidentText || userText).slice(0, 30));
  const ownChannel = !hasRiskyLink && first(OWN_CHANNEL, all);
  const askedNothing = first(ASKED_NOTHING, all);
  const dataExposed: Facts["dataExposed"] = [];
  const emailOnly = first(EMAIL_ONLY, all);
  const leaked = first(PASSWORD_LEAK, all);
  if (emailOnly) {
    dataExposed.push("email_only");
    quote("dataExposed", emailOnly);
  } else if (incidentType === "data_breach_notice" && leaked) {
    dataExposed.push("password");
    quote("dataExposed", leaked);
  }
  const bankLogin = first(BANK_LOGIN, all);
  if (bankLogin && did.includes("entered_login")) {
    dataExposed.push("bank_login");
    quote("dataExposed", bankLogin);
  }

  const stranger = first(STRANGER, all);
  if (stranger) quote("contactStartedBy", stranger);

  return {
    language,
    incidentType,
    contactStartedBy: stranger ? "stranger" : null,
    pretendsToBe: pick(POSES, all, "pretendsToBe"),
    assetInvolved: [],
    asksFor: ownChannel || askedNothing ? [] : collect(ASKS, incidentText || userText, "asksFor"),
    userAlreadyDid: did,
    dataExposed,
    selfInitiated,
    independentlyVerified: flag(VERIFIED, all, "independentlyVerified"),
    asksNothing: ownChannel || askedNothing ? flag(ownChannel ? OWN_CHANNEL : ASKED_NOTHING, all, "asksNothing") : null,
    passwordReused: flag(REUSED, userText, "passwordReused"),
    serviceLost: flag(SERVICE_LOST, userText, "serviceLost"),
    happeningNow: flag(LIVE, userText, "happeningNow"),
    pressureOrSecrecy: flag(PRESSURE, all, "pressureOrSecrecy"),
    personalSafetyRisk: incidentType === "partner_monitoring" ? true : null,
    asksToTracePerson: flag(TRACE, userText, "asksToTracePerson") === true,
    evidence,
  };
}

const GENERAL_TYPES: IncidentType[] = ["missed_call", "link_or_site", "unwanted_app_or_profile", "remote_session", "suspicious_attachment", "payment_detail_change"];

function fallbackType(incidentText: string, userText: string, quote: (fact: string, text: string) => void): IncidentType | null {
  const source = incidentText.trim() || userText.trim();
  if (!source || source.split(/\s+/).length < 4) return null;
  quote("incidentType", source.slice(0, 40));
  return "message_or_notice";
}
