import type { Audience, Facts, IncidentType, Language } from "./types";

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
  audience: Audience;
};

// Many users skip ä, ö and å, so patterns and text are both folded before matching.
export const fold = (text: string) =>
  text.replace(/[äÄåÅ]/gu, "a").replace(/[öÖ]/gu, "o").replace(/[’‘]/gu, "'");

const re = (source: string) => new RegExp(fold(source), "iu");

const PARTNER = re(String.raw`(?<![\p{L}])(my ex(?![\p{L}-])|my ex-(partner|husband|wife|boyfriend|girlfriend)|ex-?partner|exäni|ex-?(kumppan|mie|vaimo|puoliso|poikaystäv|tyttöystäv)\p{L}*|entinen (puoliso|mies|vaimo|kumppani)|(min|mitt) ex(?![\p{L}-])|min före detta|före detta (man|fru|sambo|partner))`);

// Someone close tracking or watching the user, or a hidden tracker. Partner words alone
// aren't enough ("my husband got a scam call"), so a tracking verb is required with them.
const STALKING = re(String.raw`(husband|wife|boyfriend|girlfriend|partner|spouse|mieheni|vaimoni|poikaystäväni|tyttöystäväni|kumppanini|puolisoni|(min|mitt) (man|fru|pojkvän|flickvän|sambo|partner)).{0,60}(track|spy|spies|spying|watching me|watches me|monitor|reads? my|knows? where|my location|seuraa|vakoil|lukee viesti|tietää missä|sijaintini|spårar|spionerar|övervakar|läser mina|vet var jag)|\bairtags?\b|tile tracker|gps tracker|tracker (in|on|under) my|seurantalaite|paikannin|spårsändare|gps-sändare|\bstalk\w*|vainoa\w*|förföljer`);

const INCIDENT_PATTERNS: [IncidentType, RegExp][] = [
  ["partner_monitoring", re(String.raw`(?<![\p{L}])(my ex(?![\p{L}-])|my ex-(partner|husband|wife|boyfriend|girlfriend)|ex-?partner|exäni|ex-?(kumppan|mie|vaimo|puoliso|poikaystäv|tyttöystäv)\p{L}*|entinen (puoliso|mies|vaimo|kumppani)|(min|mitt) ex(?![\p{L}-])|min före detta|före detta (man|fru|sambo|partner))`)],
  ["partner_monitoring", STALKING],
  ["ransomware", re(String.raw`(files?|tiedosto\p{L}*|filer\p{L}*).{0,40}(won't open|encrypted|locked|eivät aukea|ei aukea|salattu|salattiin|lukittu|går inte att öppna|krypter\p{L}*)|ransom|lunnas|lösen(summa|pengar|krav)|(pay|maksa|betala|send|demands?)\b.{0,40}(bitcoin|btc)\b|(bitcoin|btc)\b.{0,30}(payment|ransom|demand)|krypterad\w* filer`)],
  ["mailbox_takeover", re(String.raw`forwarding rule|edelleenlähetyssään|vidarebefordringsregel|wrong account number|väärä tilinumero|väärällä tilinumerolla|fel kontonummer`)],
  ["former_staff_access", re(String.raw`(former|ex-?employee|entinen|tidigare).{0,40}(employee|staff|työntekijä|anställd)|(employee|työntekijä|anställd).{0,30}(left|lähti|lähtenyt|slutade|slutat)`)],
  ["sim_or_number_change", re(String.raw`e-?sim.{0,60}(activ|aktiv|uud|new|ny)|(activ|aktivoi|aktiver).{0,40}e-?sim|number transfer|number (is being|was|has been) (moved|transferred)|numero(n)?siirto|numeron siirto|numero\w* siirr|nummerflytt|numret flyttas|to another operator|toiselle operaattorille|annan operatör|(lost|no) (signal|network)|ei kenttää|kenttä (katosi|hävisi|lähti)|katosi kenttä|ingen täckning|tappade täckning`)],
  ["unexpected_order_or_bill", re(String.raw`order confirmation|tilausvahvistus|orderbekräftelse|beställningsbekräftelse|(invoice|bill|lasku|faktura).{0,60}(never ordered|didn't order|did not order|not ordered|never asked for|en ole tilannut|emme ole tilanneet|emme tilanneet|inte beställt|aldrig beställt|inte har beställt)`)],
  ["approval_prompts", re(String.raw`approval (request|prompt)|login approval|approve|hyväksymispyyn|hyväksy(n|t)|kirjautumispyyn|godkänn|inloggningsbegär`)],
  ["unwanted_app_or_profile", re(String.raw`\b(i installed|asensin|installerade)\b|(configuration|security|root) (profile|certificate)|asetusprofiili|varmenne|\b(phone|device|mobile|puhelin|laite|mobil|telefon).{0,25}(hacked|hakkeroi|hackad|compromised|saastunut|smittad)\b|\b(hacked|hakkeroi|hackad).{0,25}(phone|device|mobile|puhelin|laite|mobil|telefon)\b|\b(malware|spyware|trojan|virus|haittaohjelma|vakoiluohjelma|skadlig kod)\b|browser extension|selainlaajennu\w*|webbläsartillägg|(search(es)?|browser|homepage|haku|selain|sökning\w*).{0,25}(redirect\w*|ohjautu\w*|omdirigera\w*)|(webcam|web camera|camera|web-?kamera|kamera)\w*.{0,30}(turn(s|ed)? on|light (is|was|came) on|by itself|itsestään|päälle|tänds|av sig själv)|watching me through|(computer|laptop|tietokone\w*|dator\w*).{0,25}(infected|saastu\w*|smittad)`)],
  ["unknown_login", re(String.raw`(trying|tries|tried) to (log|sign) in|yrittä\w* kirjautu|försök\w* logga in|logged in (to .{0,20})?from|loggat in .{0,30}från|took over|locked out|kaappasi|kaapattu|tog över|utelåst|kirjauduttu|kirjauduttiin|kirjautuminen .{0,20}(maasta|espanja|ulkomail)|sisäänkirjautum|inloggning från|inloggad från|\b(account|tili|konto).{0,25}(hacked|hakkeroi|hackad)\b|\b(hacked|hakkeroi|hackad).{0,25}(account|tili|konto)\b|\b(hacked|hakkeroi|hackad)\b|can'?t (log|sign) ?in|cannot (log|sign) ?in|can no longer (log|sign)|unable to (log|sign) ?in|(password|email|e-mail|recovery email|phone number|salasana|sähköposti\w*|lösenord\w*|e-post\w*)\s(was|has been|got|on|har)\s(changed|vaihdettu|muutettu|ändrats|ändrat|bytts)|changed (my|the) (password|email|recovery)|en pääse (kirjautumaan|tilille|sisään)|en pääse enää|kommer inte (in|åt)|hakkeroi\w*|hackat|hackade|hijacked|(account|tili\w*|kont\w*) (was |is |got |on |har )?(compromised|stolen|varastettu|kaapattu|kapat|stulet)|(instagram|facebook|tiktok|snapchat|whatsapp|gmail|outlook|hotmail|discord|steam|twitter|linkedin)\w*\s.{0,15}(stolen|hacked|taken over|varastettiin|varastettu|kaapattiin|kaapattu|stulet|kapat|kapad)|\bkapad\w*`)],
  ["data_breach_notice", re(String.raw`breach|data leak|leaked|leacked|tietovuo|tietomur|vuoti|vuotanut|vuotaneet|dataintrång|dataläcka|läckt`)],
  ["unrequested_reset", re(String.raw`password reset|reset (email|link)|salasanan (nollaus|vaihto|palautus)|nollauspyyn|återställ.{0,12}lösenord|lösenordsåterställ|(verification|security|login|sign-?in|2fa|one-?time|authentication) codes?.{0,40}(didn't|did not|never|not) (ask|request)|codes? (that )?i (didn't|did not|never) (ask|request)|(vahvistus|tunnistus|kirjautumis|turva)koodeja|koodeja.{0,30}(en ole pyytänyt|pyytämättä)|(verifierings|inloggnings|säkerhets)koder|koder.{0,30}(inte bett|inte begärt)`)],
  ["router_or_network", re(String.raw`router|reititin|reitittim|modeemi|wi-?fi|wifiss\w*|\bwlan|langaton verkko|langattom\w* verk\w*|trådlös\w* nätverk|(unknown|strange|unfamiliar) devices? (on|in|connected)|tuntemattom\w* laitte\w*|okända enheter`)],
  ["payment_detail_change", re(String.raw`(bank account|account number|tilinumero|pankkitili|kontonummer|bankkonto).{0,60}(chang|updat|new|muuttu|paivitt|uusi|uuteen|uudelle|andr|uppdater|nytt)|(new|uusi|uudelle|nytt|changed).{0,30}(bank account|account number|tilinumero|bankkonto|kontonummer)|uudelle tilille|new account`)],
  ["payment_request", re(String.raw`\b(ceo|toimitusjohtaj\w*|pomo\w*|boss|chef\w*|vd:?n?|managing director)\b`)],
  ["ransomware", re(String.raw`(screen|näyttö|skärm).{0,30}(demand|vaati|kräv)`)],
  ["remote_session", re(String.raw`remote (support|access|session|program)|etäy|etätuki|etäyhteys|fjärr`)],
  ["missed_call", re(String.raw`missed call|one ring|rang once|rang only once|puuttuva puhelu|soi (vain )?kerran|missat samtal|ringde en gång`)],
  ["phone_call", re(String.raw`(on the|in the) (line|phone)|linjalla|puhelimessa|i luren|i telefon|\b(called|call|caller|phone call|rang|ringde|samtal|soitti|soittaja|puhelu)\b`)],
  ["link_or_site", re(String.raw`\b(clicked|opened the link|avasin linkin|klikkasin|klickade|öppnade länken)\b|web ?shop|online (shop|store)|fake (shop|store|site|website)|verkkokaup\w*|nettikaup\w*|nätbutik\w*|webbutik\w*|webbshop\w*|(scanned|skannasin|skannade).{0,20}qr|\bqr[- ]?(code|koodi\w*|kod\w*)`)],
];

const POSES: [NonNullable<Facts["pretendsToBe"]>, RegExp][] = [
  ["police", re(String.raw`\b(police|poliisi\w*|polis\w*)\b`)],
  ["ceo", re(String.raw`\b(ceo|toimitusjohtaj\w*|pomo\w*|boss|chef\w*|vd)\b`)],
  ["supplier", re(String.raw`supplier|toimittaja|leverantör`)],
  ["operator", re(String.raw`operator|operaattor|operatör|subscription|liittymä|abonnemang|sim upgrade|sim-|e-?sim|\b(dna|elisa|telia|saunalahti|moi mobiili|tele2|telenor)\b`)],
  ["family", re(String.raw`my (child|son|daughter|mother|mum|dad|grandchild|grandson|granddaughter)|claiming to be my|(?<![\p{L}])(lapse|tyttäre|poika|äiti|isä|lapsenlaps|barn|dotter|mamma|pappa)|new number|uusi numero|uudesta numerosta|nytt nummer`)],
  ["bank", re(String.raw`banksid|nätbank|bankapp|mobilbank|\b(bank(?! account)|bank's|pankki(?!tili)\w*|pankin|pankista|bankid|verkkopank\w*|banken|banken?s)\b|[\p{L}]+pankki(?!tili)|[\p{L}]+pankin|verkkopank|bank identification|pankkitunnu`)],
  ["authority", re(String.raw`tax (office|refund)|vero|skatteverket|skatte|authority|viranomai|myndighet|\bkela\b|kelalta|kelasta|traficom|\bmigri\b|ulosotto|försäkringskassan|kronofogden|transportstyrelsen|migrationsverket`)],
  ["support", re(String.raw`support|tuki|asiakaspalvelu|tech support|microsoft|kundtjänst|delivery|parcel|paketti|paket|streaming|tullissa|customs|\b(netflix|amazon|apple|icloud|google|paypal|spotify|disney\+?|hbo|posti\w*|postnord|dhl|ups|fedex|gls|budbee|matkahuolto|ebay|tori|blocket|vinted|wolt|foodora|airbnb|klarna|steam)\b|booking\.com`)],
];

const ASKS: [Facts["asksFor"][number], RegExp][] = [
  ["remote_access", re(String.raw`remote (access|support|program)|etäyhteyd|etätu|fjärr(åtkomst|hjälp|stöd)|anydesk|teamviewer`)],
  ["app_install", re(String.raw`install|asenna|asentamaan|installera`)],
  ["code", re(String.raw`(?<!qr[ -])\bcodes?\b|(?<!qr-)koodi|tunnuslu|\bpin\b|(?<!qr-)\bkod(en|er)?\b`)],
  ["login", re(String.raw`\blog ?in\b|logging in|sign in|credentials|kirjaudu|kirjautu|tunnistau|(?<!verkko)tunnukse|logga in|inloggning|identify|identifying|verify your account|confirm my details|vahvista tieto|bekräfta`)],
  ["card", re(String.raw`card (details|number)|update your card|update my card|kortti|korttitie|kortuppgift|kortnummer`)],
  ["money", re(String.raw`\bpay\b|payment of|\bfees?\b|\bmaksa\w*|\bmaksu\b|käsittelymaksu|toimitusmaksu|betala|avgift|send money|send (?:me|us) (?:€|\$)?\d+(?:\s*(?:bucks|euros?|dollars?))?|send it\?|lähetä rahaa|lähettää rahat|skicka pengar|skicka pengarna|move .{0,20}(money|savings)|safe account|siirrä rahat|siirtää .{0,12}(rahat|säästöni)|turvatili|flytta .{0,20}(pengar|besparing)|säkert konto|deposit|takuuvuokr|talle(tan|ttaa|tus)|deposition|sätter in|sätta in|\binvest\w*|sijoit|investera|returns guaranteed|tuotto|avkastning|trading|gift ?cards?|google play (card|code)|itunes card|steam (card|gift)|paysafecard|lahjakort\w*|presentkort\w*|(wants?|demands?|asks? for|asked for|pay|send) .{0,20}(bitcoin|\bbtc\b|crypto)|flight ticket|lentolip\w*|flygbiljett\w*|(needs?|wants?|asks? for|pyysi|pyytää|haluaa|tarvitsee|vill ha|behöver)\s.{0,12}\d|bail\b`)],
  ["bank_change", re(String.raw`(new|changed).{0,20}(bank account|account number)|tilinumero|bankkonto`)],
];

// Only a statement about everything. "I didn't pay" says nothing about a code.
const NOTHING_DONE = re(String.raw`deleted (it|the (message|text|sms|email))|ignored it|did(n't| not) (click|open|reply|respond)|poistin (sen|viestin)|(?<![\p{L}])en (klikannut|avannut|vastannut)|raderade (det|den|meddelandet)|tog bort (det|den|meddelandet)|klickade inte|öppnade inte|svarade inte|hung up before|i did(n't| not) do anything|i did nothing|i haven't done anything|nothing yet|löin luurin ennen|lopetin puhelun ennen|(?<![\p{L}])en (tehnyt|ole tehnyt) mitään|lade på innan|gjorde inget|har inte gjort något`);

// Covers "I didn't type it" and "they asked me to type it", which are not actions taken.
// "en" means "not" in Finnish but "a" in Swedish, so denial is checked per language.
const DENIED_BEFORE: Record<Language, RegExp> = {
  en: re(String.raw`didn't|did not|haven't|have not|hadn't|never|asked (me )?to|wants? me to|told me to`),
  fi: re(String.raw`(?<![\p{L}])(en|et|emme)(?![\p{L}])|pyysi|pyytää|didn't|haven't`),
  sv: re(String.raw`(?<![\p{L}])(inte|aldrig)(?![\p{L}])|bad mig|didn't|haven't`),
};
const DENIED_AFTER = re(String.raw`^\S*\s+(inte|aldrig)(?![\p{L}])`);
const CLAUSE_BREAK = re(String.raw`[.,;:!?]|\s(ja|and|so|mutta|but|och|men)\s`);

function isDenied(text: string, match: RegExpExecArray, language: Language): boolean {
  const before = text.slice(Math.max(0, match.index - 60), match.index).split(CLAUSE_BREAK).at(-1) ?? "";
  return DENIED_BEFORE[language].test(before) || DENIED_AFTER.test(text.slice(match.index + match[0].length - 1));
}
const NEGATED_OBJECT = re(String.raw`\b(typed|entered|gave|installed|opened|paid)\s+(no|not|nothing)\b`);

const ATTACHMENT = re(String.raw`attachment|\.zip|\.docm|liite|liitteen|bilaga`);

const DID: [Facts["userAlreadyDid"][number], RegExp][] = [
  ["gave_remote_access", re(String.raw`(installed|gave|let|allowed|downloaded).{0,50}(remote|control|anydesk|teamviewer|quick ?assist|rustdesk|supremo|ultraviewer)|(asensin|annoin|latasin).{0,40}(anydesk|teamviewer|quick ?assist)|(installerade|laddade ner).{0,40}(anydesk|teamviewer)|they controlled|remote support program|etä(tuki|ohjelma|yhtey).{0,40}(asensin|annoin)|(asensin|annoin).{0,50}etä|ohjasi(vat)? (konetta|tietokonetta|puhelinta)|installerade.{0,40}fjärr|fjärr.{0,40}installerade|styrde (datorn|min)`)],
  ["installed_app", re(String.raw`i installed|i downloaded|asensin|latasin .{0,20}sovellu|installerade|laddade ner`)],
  ["opened_attachment", re(String.raw`opened (it|the attachment|the zip)|i opened .{0,30}(attachment|zip|file)|avasin (sen|liitteen|tiedoston)|öppnade (den|bilagan|filen)`)],
  ["entered_card", re(String.raw`(typed|entered|gave|put in|filled in|shared|told).{0,30}(card|cvv|cvc|security code|expiry date)|card (details|number).{0,20}(typed|entered)|(syötin|annoin|kirjoitin|täytin|kerroin).{0,30}(kort|cvv|cvc|turvakoodi)|(skrev|angav|fyllde|lämnade|gav|uppgav).{0,30}(kort|cvv|cvc|säkerhetskod)`)],
  ["paid", re(String.raw`paid .{0,40}(invoice|new account)|\b(drained|tyhjennetty|tyhjeni|tömdes)\b|\b(money|funds|savings|balance|crypto|bitcoin|rahat|säästöt|pengarna|pengar)\b.{0,25}\b(is gone|are gone|went missing|is missing|are missing|disappeared|vanished|taken|hävisi\w*|katosi\w*|kadonn\w*|on viety|försvann|försvunn\w*|är borta)|unauthori[sz]ed (charges?|transactions?|payments?|withdrawals?|purchases?)|(charges?|transactions?|payments?|withdrawals?|purchases?)\b.{0,40}\b(i|we) (didn't|did not|never) (make|made|do|authori[sz]e|recogni[sz]e)|(charges?|transactions?|payments?|purchases?) i (don't|do not) recogni[sz]e|tuntemattom\w* (veloitu|maksu|osto|tilisiir)\w*|okända (dragningar|köp|transaktioner|betalningar)|emptied (my|the|our)|(was|been) emptied|stole (my|our|\d)|stolen from|money (was|has been) (stolen|taken)|tyhjensi|tyhjennett|(?<!(puhelin|puhelim|laite|lompakko)\w{0,6} )varastettiin|varastivat|tömd|tömde|stulit|(?<![\p{L}])(i|we) (already |also |then |just )?(paid|transferred)\b|maksoimme|vi betalade|betalade .{0,40}(konto|faktura)|(?<![\p{L}])i (already )?(moved|sent) (the |my |\d)|already (moved|paid|sent)|payment (has )?(went|gone|was sent)|(?<![\p{L}])(maksoin|siirsin (rah|\d|kaik|ne|sen|jo|osan)|lähetin rahat|lähetin rahaa)|olen (jo )?(maksanut|siirtänyt)|(?<![\p{L}])(betalade|flyttade (pengar|\d|dem|allt)|förde över|skickade pengar)|har (redan )?(betalat|flyttat)|(?<![\p{L}])(i|we) (also |then |just |already )?sent (money|\d|€|\$|it|them|him|her)|\band (then )?paid\b|\b(swishade|swishat)\b|(maksoin|lähetin|siirsin)\b.{0,30}mobilepay|mobilepay\w*.{0,30}(maksoin|lähetin)|\b(bought|ostin|köpte)\b.{0,20}(gift ?cards?|lahjakort\w*|presentkort\w*)|(ordered|bought|tilasin|ostin|beställde|köpte).{0,60}(never (arrived|came|delivered)|did(n't| not) (arrive|come)|ei (koskaan )?(tullut|saapunut)|eikä .{0,20}(tullut|saapunut)|kom aldrig|har inte kommit)`)],
  ["shared_code", re(String.raw`(typed|gave|read out|entered|shared|told|said).{0,40}(code|\bpin\b|passcode|seed phrase|recovery phrase)|(sa|berättade|uppgav).{0,30}(kod|pin)|(?<=code.{0,60})i (sent|forwarded|gave)|(sent|forwarded) (it|the code)|(?<=koodi.{0,60})(lähetin|annoin)|(?<=kod.{0,60})(skickade|gav)|code .{0,20}(typed|gave|read)|(annoin|luin|syötin|kirjoitin|kerroin).{0,50}(koodi|tunnuslu)|(gav|läste upp|skrev|angav).{0,30}(kod|pin)`)],
  ["entered_login", re(String.raw`(typed|entered|signed in|logged in|gave|identified).{0,40}(password|credentials|work email|login|through a link|banking details|bank details|online banking|bank ?id|my bank|mobile id|bank credentials)|(tunnistauduin|vahvistin pankkitunnuksilla)|(identifierade mig|legitimerade mig)|logged in to a fake|logged in through|signed in with|(syötin|annoin|kirjoitin|kirjauduin).{0,40}(salasan|tunnuks|linkin|linkistä|sähköposti)|kirjauduin|(työntekijä\w*|employee).{0,20}(kirjautui|signed in)|(skrev|angav|loggade in).{0,40}(lösenord|inloggning|länk|nätbank)|loggade in`)],
  ["opened_link", re(String.raw`clicked (on )?(an |the |a )?(ad|advert\w*|banner|button)\b|(klikkasin|painoin) mainos\w*|klickade på (en |annonsen)|(link|linkki|länk).{0,40}(clicked|klikkasin|avasin|klickade|öppnade)|(clicked|opened|tapped|followed).{0,40}link|link .{0,20}(clicked|opened)|(avasin|klikkasin|painoin|napautin).{0,40}(linkki|linkin)|linkin.{0,20}(avasin|klikkasin)|(klickade|öppnade|tryckte).{0,30}länk`)],
];

const SELF_YES = re(String.raw`i('m| am) (logging|signing) in|i ordered|we booked|we ordered|i booked|booked .{0,30}(partner|support)|tiketin tein itse|i made the ticket|tilasin|tilasimme|olen kirjautumassa|olen ottamassa|kirjaudun juuri|lisäsin|i added|jag lade till|jag beställde|vi beställde|vi bokade|jag loggar in`);
const SELF_NO = re(String.raw`(didn't|did not|not) (ask|request|start|initiate|log|logging|sign|order)|i'm not logging|never asked|wasn't me|took over|locked out|hacked|se en ollut minä|kaappasi|kaapattu|hakkeroi|det var inte jag|aldrig bett|tog över|utelåst|hackad|hackat|(?<![\p{L}])en (ole kirjautu|pyytänyt|ole pyytänyt|aloittanut|tilannut)|ei tilattu|har inte (bett|begärt|startat|beställt)|bad inte(?! om)|loggar inte in`);
const VERIFIED = re(String.raw`(called|phoned|rang).{0,60}(number in our contract|known number|confirmed)|she confirmed|he confirmed|soitin.{0,50}(sopimuksen|tuttuun|vahvisti)|soittamalla.{0,50}tuttuun|vahvisti muutoksen|ringde.{0,50}(avtalet|bekräftade|känt)|genom att ringa|bekräftade ändringen`);
const ORDER_PLACED_BY = re(String.raw`\((admin|pääkäyttäjä|administratör)\)`);

const PRESSURE = re(String.raw`(send|share|post|leak|show|spread) (it|them|the (video|photos?|pictures?|images?)) (to|with) (all )?(my|your) (friends|family|contacts|followers|colleagues)|ha(s|ve) (a |an )?(video|recording|photos?|pictures?) of (me|you)|(lähettä\w*|jakaa?|julkais\w*) (sen|ne|kuvat|videon) (kavereille|ystäville|perheelle|kontakteille|työkavereille)|(skicka|sprida|visa) (den|dem|bilderna|videon) (till|för) (mina|dina) (vänner|kontakter|familj|kollegor)|blackmail\w*|extort\w*|sextort\w*|threaten\w*|nude (photos?|pictures?|images?|videos?)|nudes\b|intimate (photos?|pictures?|images?|videos?)|kiristä\w*|kiristy\w*|kiristet\w*|uhkaa|uhkasi|alastonkuv\w*|intiimikuv\w*|utpress\w*|hotar|hotade|nakenbild\w*|intima bilder|urgent|immediately|within \d+|by today|keep it (confidential|secret)|confidential|suspended|expire|expiring|locked|overdue|kiire|välittömästi|heti|tunnin sisällä|luottamuksellis|lukittu|erääntyy|vanhenee|suljetaan|bråttom|omedelbart|inom \d+|hemlig|konfidentiell|spärrad|löper ut|stängs|virus|don't remember|en muista|minns inte|same thread|samma tråd|samassa ketjussa`);
const DEFENSIVE_IMMEDIATE = re(String.raw`(deleted|hung up|closed|removed|changed|reported|ignored|poistin|suljin|vaihdoin|ilmoitin|lopetin|raderade|lade på|stängde|bytte|anmälde).{0,25}(immediately|heti|välittömästi|omedelbart)`);
const LIVE = re(String.raw`still on the (phone|line)|on the (phone|line) (now|right now)|calling (me )?(right )?now|right now|juuri nyt|on (vielä )?linjalla|puhelu on käynnissä|just nu|fortfarande i (telefon|luren)|på linjen`);
const TRACE = re(String.raw`who owns|find out who|find (me )?(this|the) scammer|scammer's (address|name)|expose (him|her|them|this|the scammer)|publish (their|his|her) name|kuka omistaa|selvittää kuka|selvitä kuka|paljasta (hänet|huijari)|julkaista (hänen|huijarin)|etsi .{0,30}huijari|huijarin (osoite|nimi)|vem som äger|ta reda på vem|hitta bedragaren|bedragarens (adress|namn)|hänga ut|publicera (hans|hennes|namnet)`);

const EMAIL_ONLY = re(String.raw`only my email|only (an |your )?email|(?<!, )names and email|no passwords|vain sähköposti|ei salasanoja|(?<!, )nimet ja sähköposti|endast e-post|bara (min )?e-post|inga lösenord`);
const NO_PASSWORD = re(String.raw`no passwords|did not include passwords|ei salasanoja|salasanoja (tai .{0,30})?ei|salasanat eivät|inga lösenord|lösenord (har )?inte`);
const PASSWORD_LEAK = re(String.raw`passwords?|salasan|lösenord`);
const BANK_LOGIN = re(String.raw`bank credentials|banking details|online bank|nätbank|verkkopankki|pankkitunnu|internetbank|bank-?id|bank account|pankkitili|bankkonto`);
const IDENTITY_MISUSE = re(String.raw`(loan|credit|account|subscription|contract|purchases?|laina\w*|luotto\w*|lån|kredit\w*).{0,40}(in my name|nimissäni|nimelläni|i mitt namn)|identity theft|identiteettivarkau\w*|id-?stöld|identitetsstöld|stole my identity|varasti\w* henkilöllisyyteni|stal min identitet`);
const ID_DOCUMENT = re(String.raw`henkilötunnu\w*|\bhetu\b|social security|personal identity code|personnummer|passport|\bpassi\w*|ajokort\w*|driver'?s licen[cs]e|körkort|id card|henkilökort\w*|id-kort`);
const REUSED = re(String.raw`same password|samaa salasanaa|samma lösenord`);
const SERVICE_LOST = re(String.raw`lost signal|no signal|ei kenttää|kenttä (katosi|hävisi|lähti)|katosi kenttä|ingen täckning|tappade täckning`);
const STRANGER = re(String.raw`unknown number|someone called|tuntemat|joku soitti|okänt nummer|någon ringde`);

function first(pattern: RegExp, text: string): string | null {
  const match = pattern.exec(text);
  return match ? match[0] : null;
}

// Genuine notices send you to your own app and ask for nothing here.
const OWN_CHANNEL = re(String.raw`in the app|in your online|as usual|contains no links|no links?\b|sovelluksessa|sovelluksesta|verkkopankkiin|verkkopalvelussa|oma-|omassa|i appen|i din|som vanligt|inga länkar|ei sisällä linkkejä|ei ole linkkiä|automaatti`);
// A direct demand beats any reassuring phrase, because scammers can write those too.
const DEMAND = re(String.raw`\bpay\b|send money|send \d|\bgive\b|\binstall\b|enter your|send your|update your|confirm your|verify your|sign in|log in (here|now|at|via|through)|\bclick\b|\bmaksa\b|syötä|päivitä|vahvista|\banna\b|kirjaudu (tästä|täällä|linkistä)|klikkaa|\bbetala\b|\bange\b|uppdatera|bekräfta|skicka din|logga in (här|nu|via)|klicka`);
const REPORTED_REQUEST = re(String.raw`asked (me )?(for|to)|wants? (me|my)|told me to|pyysi|pyytää|halusi|vaati|bad (mig|om)|vill ha`);
const ASKED_NOTHING = re(String.raw`asks? for nothing|asked for nothing|ei pyydä mitään|eivät pyytäneet mitään|ber inte om något|bad inte om något|asked for nothing|asked for no details|no details|ei pyytänyt mitään|ei kysynyt mitään|ei pyytänyt tietoja|bad inte om något|bad inte om några`);

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

  const did: Facts["userAlreadyDid"] = [];
  for (const [action, pattern] of DID) {
    const match = pattern.exec(userText);
    if (match && !isDenied(userText, match, language) && !NEGATED_OBJECT.test(match[0])) {
      did.push(action);
      quote(`userAlreadyDid:${action}`, match[0]);
    }
  }
  const nothing = first(NOTHING_DONE, userText);
  if (nothing && did.length === 0) {
    did.push("nothing");
    quote("userAlreadyDid:nothing", nothing);
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
  const demanded = first(DEMAND, all);
  // The user's own words count as a request only when they report someone asking.
  const requestText = first(REPORTED_REQUEST, userText) ? all : incidentText || userText;
  const ownChannel = !hasRiskyLink && !demanded && first(OWN_CHANNEL, all);
  const askedNothing = !demanded && first(ASKED_NOTHING, all);
  const dataExposed: Facts["dataExposed"] = [];
  const emailOnly = first(EMAIL_ONLY, all);
  const leaked = first(PASSWORD_LEAK, all);
  // Only the notice counts: "do I need to change my passwords?" is the user's question.
  if (emailOnly && (!first(PASSWORD_LEAK, incidentText) || first(NO_PASSWORD, all))) {
    dataExposed.push("email_only");
    quote("dataExposed", emailOnly);
  } else if (incidentType === "data_breach_notice" && leaked) {
    dataExposed.push("password");
    quote("dataExposed", leaked);
  }
  const bankLogin = first(BANK_LOGIN, all);
  if (bankLogin && (did.includes("entered_login") || incidentType === "data_breach_notice" || /leak|leack|vuot|läck/iu.test(all))) {
    dataExposed.push("bank_login");
    quote("dataExposed", bankLogin);
  }

  // A loan or account opened in the user's name means their identity is already in use.
  // ID documents count only when a leak is reported, since "I renewed my passport" is not one.
  const identity = first(IDENTITY_MISUSE, userText) ?? (incidentType === "data_breach_notice" ? first(ID_DOCUMENT, all) : null);
  if (identity) {
    dataExposed.push("identity");
    quote("dataExposed", identity);
  }

  const medical = first(re(String.raw`\b(doctor|physician|ambulance|hospital|medical emergency|need a doctor|call an ambulance|lääkäri|ambulanssi|sairaala|hätätila|ensiapu|läkare|ambulans|sjukhus)\b`), all);
  if (medical) quote("personalSafetyRisk", medical);

  const stranger = first(STRANGER, all);
  if (stranger) quote("contactStartedBy", stranger);

  return {
    language,
    incidentType,
    contactStartedBy: stranger ? "stranger" : null,
    pretendsToBe: pick(POSES, all, "pretendsToBe"),
    assetInvolved: [],
    asksFor: ownChannel || askedNothing ? [] : collect(ASKS, requestText, "asksFor"),
    userAlreadyDid: did,
    dataExposed,
    selfInitiated,
    // Scam text can claim to be verified, so only the user's words count. The one
    // exception is a named admin on an order, which rules still check for contradictions.
    independentlyVerified:
      flag(VERIFIED, userText, "independentlyVerified") ??
      (incidentType === "unexpected_order_or_bill" ? flag(ORDER_PLACED_BY, incidentText, "independentlyVerified") : null),
    asksNothing: ownChannel || askedNothing ? flag(ownChannel ? OWN_CHANNEL : ASKED_NOTHING, all, "asksNothing") : null,
    passwordReused: flag(REUSED, userText, "passwordReused"),
    serviceLost: flag(SERVICE_LOST, userText, "serviceLost"),
    happeningNow: flag(LIVE, userText, "happeningNow"),
    // Pressure comes from whoever contacted the user, not the user's own defensive speed or "today".
    pressureOrSecrecy: flag(PRESSURE, incidentText || (first(DEFENSIVE_IMMEDIATE, userText) ? "" : userText), "pressureOrSecrecy"),
    personalSafetyRisk: (incidentType === "partner_monitoring" ? flag(PARTNER, all, "personalSafetyRisk") ?? flag(STALKING, all, "personalSafetyRisk") : null) ?? (medical ? true : null),
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
