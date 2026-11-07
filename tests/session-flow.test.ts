import approved from "../content/approved-text.json";
import { describe, expect, it } from "vitest";
import { fastDanger } from "../engine/fast-danger";
import { handleEvent } from "../engine/handle-event";
import { safeScreen } from "../engine/output-guard";
import type { CaseInput } from "../engine/assess";

const input = (message: string, language: CaseInput["language"] = "en"): CaseInput => ({
  audience: "consumer", language, openingMessage: message, incidentContent: null, incidentChannel: null,
  signals: { hasLink: false, linkVerdict: null, callWarning: null, callerSpoofed: false },
  consent: { requires: [], preGranted: [] },
});

describe("session flow", () => {
  it.each([
    ["The bank is on the phone right now asking for my code", "en"],
    ["Pankki on linjalla juuri nyt ja pyytää koodia", "fi"],
    ["Banken är fortfarande på linjen just nu och ber om koden", "sv"],
  ] as const)("pauses live code requests in %s", (message, language) => {
    expect(fastDanger(message)).toBe("code");
  });

  it("returns a stop screen and can continue", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: input("The bank is on the phone right now asking for my code"), sentToLlm: false });
    expect(started.response.screen.type).toBe("stop");
    const continued = await handleEvent("test", started.journey, { kind: "continue" });
    expect(continued.response.screen.type).not.toBe("stop");
  });

  it("rejects an answer to a question not asked", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: input("help"), sentToLlm: false });
    await expect(handleEvent("test", started.journey, { kind: "answer", topic: "card_details_entered", answer: "yes" })).rejects.toThrow("invalid_topic");
  });

  it("blocks unsafe output", () => {
    expect(safeScreen({ type: "end", message: "This is guaranteed safe" })).toBe(false);
  });

  it("rejects a wrong-language stop screen", () => {
    expect(safeScreen({ type: "stop", message: "Stop. Don't read out or type any code.", actions: ["End the call now. No bank, authority or operator will ask you to read out a code."] }, "fi")).toBe(false);
  });

  it("rejects unapproved instructions in conditional branches", () => {
    expect(safeScreen({ type: "flip", topic: "self_initiated", question: "Did you do or order this yourself?", why: "If you did, this is normal. If not, someone else may have.", statusLabel: "Needs checking", branches: [{ condition: "If you did not do this yourself:", steps: ["Send your code to the caller."] }] }, "en")).toBe(false);
  });

  it("does not access an optional signal after refusal", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: { ...input("I logged in from my new laptop myself, but got an unknown login alert."), consent: { requires: ["operator_account.recent_logins"], preGranted: [] } }, demoScenario: "unknown_login", sentToLlm: false });
    let journey = started.journey!;
    let screen = started.response.screen;
    if (screen.type === "flip") {
      const answered = await handleEvent("test", journey, { kind: "answer", topic: screen.topic, answer: "no" });
      journey = answered.journey!;
      screen = answered.response.screen;
    }
    expect(screen.type).toBe("unlock");
    if (screen.type === "unlock") {
      const refused = await handleEvent("test", journey, { kind: "consent", signal: screen.signal, granted: false });
      expect(refused.response.dataReceipt.refused).toContain(screen.signal);
      expect(refused.response.dataReceipt.used).not.toContain(screen.signal);
    }
  });

  it("uses a consented login finding to change the action path", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: { ...input("I logged in from my new laptop myself, but got an unknown login alert."), consent: { requires: ["operator_account.recent_logins"], preGranted: [] } }, demoScenario: "unknown_login", sentToLlm: false });
    // A new laptop alone no longer proves the login was the user's own, so SafeStep asks first.
    expect(started.response.screen.type).toBe("flip");
    const answered = await handleEvent("test", started.journey, { kind: "answer", topic: "self_initiated", answer: "yes" });
    expect(answered.response.screen.type).toBe("unlock");
    const granted = await handleEvent("test", answered.journey, { kind: "consent", signal: "operator_account.recent_logins", granted: true });
    expect(granted.response.dataReceipt.used).toContain("operator_account.recent_logins");
    expect(granted.response.summary.some(line => line.includes("simulated account check"))).toBe(true);
    expect(granted.response.state.urgency).toBe("immediate");
    expect(granted.response.state.destination).toBe("security_specialist");
  });

  it("rejects consent for a signal that was not requested", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: input("help"), sentToLlm: false });
    await expect(handleEvent("test", started.journey, { kind: "consent", signal: "credential_exposure", granted: true })).rejects.toThrow("invalid_event_order");
  });

  it.each([
    ["sim_change", "An operator called and asked for a code. I did not give it.", "subscription.recent_events"],
    ["device_issue", "I gave a caller remote access to my computer, but entered no credentials.", "device.security_findings"],
    ["business_access", "A former employee left but still has access to our business accounts.", "business.staff_accounts"],
  ] as const)("uses consent only when %s changes the response", async (demoScenario, message, expectedSignal) => {
    let flow = await handleEvent("test", null, { kind: "start", input: { ...input(message), audience: demoScenario === "business_access" ? "small_business" : "consumer", consent: { requires: [expectedSignal], preGranted: [] } }, demoScenario, sentToLlm: false });
    for (let i = 0; i < 3 && flow.response.screen.type !== "unlock"; i++) {
      const screen = flow.response.screen;
      if (screen.type === "stop") flow = await handleEvent("test", flow.journey, { kind: "continue" });
      else if (screen.type === "flip") flow = await handleEvent("test", flow.journey, { kind: "answer", topic: screen.topic, answer: "no" });
      else break;
    }
    expect(flow.response.screen.type).toBe("unlock");
    if (flow.response.screen.type !== "unlock") return;
    const before = flow.response.state;
    const after = await handleEvent("test", flow.journey, { kind: "consent", signal: flow.response.screen.signal, granted: true });
    expect(after.response.dataReceipt.used).toContain(expectedSignal);
    expect([after.response.state.urgency, after.response.state.destination]).not.toEqual([before.urgency, before.destination]);
  });

  it("blocks an out-of-order rescue event", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: input("help"), sentToLlm: false });
    await expect(handleEvent("test", started.journey, { kind: "rescue", stepId: "0", outcome: "done" })).rejects.toThrow("invalid_event_order");
  });

  it("advances recovery one step at a time and requires handoff review", async () => {
    let flow = await handleEvent("test", null, { kind: "start", input: input("Someone asked for my WhatsApp code and I gave the code to them."), sentToLlm: false });
    expect(flow.response.screen.type).toBe("rescue");
    while (flow.response.screen.type === "rescue") {
      flow = await handleEvent("test", flow.journey, { kind: "rescue", stepId: flow.response.screen.step.id, outcome: "done" });
    }
    expect(flow.response.screen.type).toBe("handoff");
    flow = await handleEvent("test", flow.journey, { kind: "handoff", approved: false });
    expect(flow.response.screen.type).toBe("result");
  });

  it("offers a person from any step and then carries on", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: input("I opened a link in a parcel text asking for card details."), sentToLlm: false });
    const asked = await handleEvent("test", started.journey, { kind: "talk_to_person" });
    expect(asked.response.screen).toMatchObject({ type: "handoff", destination: "operator_support_agent" });
    expect(asked.response.state.destination).toBe("operator_support_agent");
    const declined = await handleEvent("test", asked.journey, { kind: "handoff", approved: false });
    expect(declined.response.screen.type).toBe(started.response.screen.type);
  });

  it("sends a business user to business support", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: { ...input("help"), audience: "small_business" }, sentToLlm: false });
    const asked = await handleEvent("test", started.journey, { kind: "talk_to_person" });
    expect(asked.response.screen).toMatchObject({ type: "handoff", destination: "business_security_support" });
  });

  it("warns about a live remote-access request, then asks whether access was granted", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: input("A caller says they are from Microsoft and is asking for remote access to my laptop right now."), sentToLlm: false });
    expect(started.response.screen.type).toBe("stop");
    const continued = await handleEvent("test", started.journey, { kind: "continue" });
    expect(continued.response.screen).toMatchObject({ type: "flip", topic: "remote_access_given" });
    const no = await handleEvent("test", continued.journey, { kind: "answer", topic: "remote_access_given", answer: "no" });
    expect(no.response.state.status).toBe("threat_in_progress");
    const yes = await handleEvent("test", continued.journey, { kind: "answer", topic: "remote_access_given", answer: "yes" });
    expect(yes.response.state.status).toBe("incident_occurred");
  });

  it("asks whether money was sent after a payment request", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: input("I got a message saying I need to pay someone 500 euros."), sentToLlm: false });
    expect(started.response.screen).toMatchObject({ type: "flip", topic: "money_transferred" });
    const no = await handleEvent("test", started.journey, { kind: "answer", topic: "money_transferred", answer: "no" });
    expect(no.response.state.status).toBe("threat_in_progress");
    const yes = await handleEvent("test", started.journey, { kind: "answer", topic: "money_transferred", answer: "yes" });
    expect(yes.response.state.status).toBe("incident_occurred");
    expect(yes.response.state.externalContacts).toContain("bank");
    const unsure = await handleEvent("test", started.journey, { kind: "answer", topic: "money_transferred", answer: "unsure" });
    expect(unsure.response.state.status).toBe("needs_verification");
  });

  it("shows readable unknowns and sources, not internal ids", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: input("I opened a link in a parcel text asking for card details."), sentToLlm: false });
    const done = await handleEvent("test", started.journey, { kind: "answer", topic: (started.response.screen as { topic: "card_details_entered" }).topic, answer: "unsure" });
    expect(done.response.screen.type).toBe("result");
    const screen = done.response.screen as Extract<typeof done.response.screen, { type: "result" }>;
    expect(screen.unknowns.join(" ")).not.toMatch(/_/);
    expect(screen.sources.map((source) => source.title).join(" ")).not.toMatch(/guidance_/);
  });

  it("can leave a Stop raised only by the fast danger check", async () => {
    const message = "Someone from my bank is on the line right now and is asking for the code from my text message.";
    const started = await handleEvent("test", null, { kind: "start", input: input(message), sentToLlm: false });
    expect(started.response.screen.type).toBe("stop");
    const next = await handleEvent("test", started.journey, { kind: "continue" });
    expect(next.response.screen.type).not.toBe("stop");
  });

  describe("end of the journey", () => {
    const finish = async (message: string, answers: Record<string, "yes" | "no"> = {}) => {
      let { journey, response } = await handleEvent("test", null, { kind: "start", input: input(message), sentToLlm: false });
      for (let turn = 0; turn < 14; turn += 1) {
        const { screen } = response;
        if (screen.type === "result") break;
        const event = screen.type === "stop" ? ({ kind: "continue" } as const)
          : screen.type === "flip" ? ({ kind: "answer", topic: screen.topic, answer: answers[screen.topic] ?? "no" } as const)
          : screen.type === "rescue" ? ({ kind: "rescue", stepId: screen.step.id, outcome: "done" } as const)
          : ({ kind: "handoff", approved: true } as const);
        ({ journey, response } = await handleEvent("test", journey, event));
      }
      return { journey, response, screen: response.screen as Extract<typeof response.screen, { type: "result" }> };
    };

    it("explains a safe case and offers a closer look", async () => {
      const { screen, response } = await finish("My bank texted that I have a new message in my online bank. There is no link and it asks for nothing.");
      expect(response.state.status).toBe("safe");
      expect(screen.story.prevent.length).toBeGreaterThan(0);
      expect(screen.story.investigation.spot).not.toBe("");
    });

    it("sums up an incident and points to the bank", async () => {
      const { screen, response } = await finish("I clicked a parcel link and typed my card number on the page.", { card_details_entered: "yes" });
      expect(response.state.status).toBe("incident_occurred");
      expect(screen.supportRoutes[0]).toBe("bank");
      expect(screen.completed.length).toBeGreaterThan(0);
    });

    it("routes a chosen contact to that support", async () => {
      const { journey } = await finish("I clicked a parcel link and typed my card number on the page.", { card_details_entered: "yes" });
      const asked = await handleEvent("test", journey, { kind: "talk_to_person", route: "bank" });
      expect(asked.response.screen).toMatchObject({ type: "handoff", route: "bank" });
    });

    it("calls a message the user left alone safe, without questions", async () => {
      for (const [message, language] of [
        ["I got a text saying I won a prize, I deleted it and did not click anything.", "en"],
        ["Sain viestin että voitin palkinnon, poistin sen enkä klikannut mitään.", "fi"],
        ["Fick ett sms om att jag vunnit, jag raderade det och klickade inte på något.", "sv"],
      ] as const) {
        const { response } = await handleEvent("test", null, { kind: "start", input: input(message, language), sentToLlm: false });
        expect(response.screen).toMatchObject({ type: "result", statusLabel: approved.statusLabels.safe[language] });
      }
    });

    it("reads a Finnish click after the link is named", async () => {
      const message = "Sain viestin että paketti on jumissa ja linkki, klikkasin sitä mutta en antanut mitään tietoja.";
      const { response } = await handleEvent("test", null, { kind: "start", input: input(message, "fi"), sentToLlm: false });
      expect(response.screen).toMatchObject({ type: "describe", reason: "link_context" });
    });

    it("offers the bank first when a caller poses as the bank", async () => {
      const { screen } = await finish("Someone from my bank called and is on the line now asking for my code", { code_shared: "no" });
      expect(screen.supportRoutes[0]).toBe("bank");
    });

    it("offers a person when a step can't be done", async () => {
      const started = await handleEvent("test", null, { kind: "start", input: input("I clicked a parcel link and typed my card number on the page."), sentToLlm: false });
      let { journey, response } = started;
      if (response.screen.type === "flip") ({ journey, response } = await handleEvent("test", journey, { kind: "answer", topic: response.screen.topic, answer: "yes" }));
      const screen = response.screen as Extract<typeof response.screen, { type: "rescue" }>;
      const next = await handleEvent("test", journey, { kind: "rescue", stepId: screen.step.id, outcome: "not_possible" });
      expect(next.response.screen).toMatchObject({ type: "handoff", route: "bank" });
    });

    it("drops advice that doesn't fit the case", async () => {
      const { screen } = await finish("The police called and told me to move my money to a safe account. I already moved 5000 euros.");
      expect(screen.steps.join(" ")).not.toMatch(/block the card/i);
    });
  });

  describe("vague messages", () => {
    const answerAll = async (message: string, answers: ("yes" | "no" | "unsure")[]) => {
      let { journey, response } = await handleEvent("test", null, { kind: "start", input: input(message), sentToLlm: false });
      const topics: string[] = [];
      for (const answer of answers) {
        const { screen } = response;
        if (screen.type === "stop") ({ journey, response } = await handleEvent("test", journey, { kind: "continue" }));
        const asked = response.screen;
        if (asked.type !== "flip") break;
        topics.push(asked.topic);
        ({ journey, response } = await handleEvent("test", journey, { kind: "answer", topic: asked.topic, answer }));
      }
      return { journey, response, topics };
    };

    it.each(["help", "I got a suspicious message", "something weird happened"])("asks instead of guessing: %s", async (message) => {
      const { response } = await handleEvent("test", null, { kind: "start", input: input(message), sentToLlm: false });
      expect(response.screen).toMatchObject({ type: "flip", topic: "time_of_event" });
      expect(response.state.risk).toBe("medium");
    });

    it("stops the user when it is happening now", async () => {
      const { response } = await answerAll("help", ["yes"]);
      expect(response.screen).toMatchObject({ type: "stop", message: "Stop. Don't give them anything." });
    });

    it("sends shared details to the bank", async () => {
      const { response, topics } = await answerAll("help", ["no", "yes"]);
      expect(topics).toEqual(["time_of_event", "account_affected"]);
      expect(response.state.externalContacts).toContain("bank");
      expect(response.state.status).toBe("incident_occurred");
      expect(response.screen.type).toBe("rescue");
    });

    it("treats device access as a device incident", async () => {
      const { response } = await answerAll("help", ["no", "no", "no", "yes"]);
      expect(response.state.destination).toBe("security_specialist");
    });

    it("gives a calm result when every answer is no", async () => {
      const { response, topics } = await answerAll("help", ["no", "no", "no", "no"]);
      expect(topics).toHaveLength(4);
      expect(response.screen.type).toBe("result");
      expect(response.state).toMatchObject({ status: "needs_verification", risk: "medium" });
    });

    it("keeps Not sure unknown but covers the worse answer", async () => {
      const { response } = await answerAll("help", ["no", "unsure", "no", "no"]);
      expect(response.screen).toMatchObject({ type: "result" });
      expect(response.state.status).toBe("needs_verification");
      expect(response.state.externalContacts).toContain("bank");
    });
  });
});
