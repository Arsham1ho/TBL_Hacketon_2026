# Comprehension check

The brief asks us to report comprehension: can someone outside the team say the next step in their own words? Task B18 needs at least three people.

## How to run it

1. Find at least three people outside the team. Note their tech confidence (low, medium or high), not their names.
2. Read each answer aloud once, or let them read it once, in a language they know well. Don't explain anything.
3. Ask: **"What would you do first, and why?"** Write their words down exactly.
4. Mark **Understood** as yes if their first step matches the answer's first action, partly if it's roughly right, and no otherwise.
5. Don't coach or repeat. If they ask to hear it again, note that, because it's a finding.

Record results in `RESULTS.md` section 6, and only if the test really happened. Never fill this in from guesses.

## 1. Suspicious call, money already moved (English, `DSA-D-0477`)

**User said:** The police called and asked me to move my money to a safe account because someone at the bank is a criminal. I already moved some. Now I'm doubting it.

**SafeStep answered:**

> Contact your bank using its official app or a trusted number. Tell them about the transfer and ask whether it can be stopped or recovered. Check your bank transactions for anything you don't recognise. Report it to the police. You said money was sent. Your bank can check whether it can stop or recover the payment, so contact it promptly. We can pass this to a person, with a summary you approve first.

**Expected first action:** `contact_bank_and_block_cards`

## 2. Clicked link, harmless (English, `DSA-D-0544`)

**User said:** I clicked the tracking link in an order confirmation and only then wondered whether I should have. I ordered just now myself.

**SafeStep answered:**

> This looks like a normal, genuine event, so you don't need to do anything. You told us you did this yourself, so it fits a normal change.

**Expected first action:** `no_action_needed`

## 3. Clicked link, app installed (Finnish, `DSA-D-0529`)

**User said:** Latasin jonkun sovelluksen linkistä kun piti kuunnella ääniviesti. Taisin antaa sille kaikki luvat.

**SafeStep answered:**

> Katkaise laitteen verkkoyhteys nyt, esimerkiksi lentotilalla. Älä käytä pankkipalveluita tällä laitteella ennen tarkistusta. Poista asentamasi sovellus, profiili tai ohjelma. Joku saattaa pystyä ohjaamaan tai lukemaan tätä laitetta. Voimme siirtää asian ihmiselle yhteenvedolla, jonka hyväksyt ensin.

**Expected first action:** `isolate_device_and_scan`

## 4. Small business, ransomware (Swedish, `DSA-D-0031`)

**User said:** Det här oroar mig. Jag frågar för företagets räkning. Filerna på butikens dator går inte att öppna och skärmen kräver bitcoin.

**SafeStep answered:**

> Koppla bort enheten från nätet nu, till exempel med flygläge. Varna personalen och berörda kunder. Betala inte och för inte över pengar ännu. Utpressningsprogram kan spridas i hela nätverket. Betala inte — det återställer sällan filer och märker ditt företag som ett mål. Vi kan lämna över detta till en person med en sammanfattning som du godkänner först.

**Expected first action:** `isolate_device_and_scan`

## 5. Suspicious call, code read out (Swedish, `DSA-D-0090`)

**User said:** någon ringde från 'min operatör' och erbjöd en sim-uppgradering. jag fick en kod och han bad mig läsa upp den. jag är inte så bra på teknik

**SafeStep answered:**

> Om du gav koden till någon: Kontakta operatörens kundtjänst på det officiella numret eller i appen. Be dem spärra ditt SIM, eSIM och numret. Kontakta din bank nu på dess officiella nummer eller i bankens egen app. Om du behöll koden för dig själv: Dela aldrig koder eller PIN-koder med någon. Lägg på och ring inte tillbaka. Den som har ditt nummer kan ta emot dina bank- och inloggningskoder. Läste du upp eller skrev du in koden? Vi kan lämna över detta till en person med en sammanfattning som du godkänner först.

**Expected first action:** `contact_operator_support`

## Results

Run on 8 November with 3 people outside the team, reading each answer once and asking “What would you do first, and why?” Words are written down as said, lightly cleaned for spelling. Not every listener heard every answer: C was read only to a listener who could follow it. **Result: 6 responses, 4 understood, 1 partly, 0 repeats needed, 1 not understood.**

What we learned: the harmless answer (B) was understood by everyone. The money-sent answer (A) was understood by the high-confidence listener; the medium-confidence listener got the bank but put “block the number” first; the low-confidence listener went to the police and friends instead of the bank. Answer A mentions the police in the same breath as the bank, so we would make the order explicit: “First call your bank. Then report to the police.”

| Case | Listener (tech confidence) | Their own words | Understood? | Needed a repeat? |
|---|---|---|---|---|
| A `DSA-D-0477` | P1 (medium) | “Block the number, freeze my bank, then contact my bank and then the police.” | partly | no |
| B `DSA-D-0544` | P1 (medium) | “I did it by myself, so no problem.” | yes | no |
| A `DSA-D-0477` | P2 (high) | “Contact the bank and the police, try to get a new card, check my last transactions and figure out how I can get my money back.” | yes | no |
| B `DSA-D-0544` | P2 (high) | “Why should I worry? Everything is fine.” | yes | no |
| C `DSA-D-0529` | P2 (high) | “Disconnect the internet, remove the app, show it to an expert, run antivirus, change my password and credentials.” | yes | no |
| A `DSA-D-0477` | P3 (low) | “Call the police and follow their guide, ask my friends, turn off my phone.” | no | no |
