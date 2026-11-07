import { describe, expect, it } from "vitest";
import { handleEvent } from "../engine/handle-event";
import { offlineExtract } from "../engine/offline-extractor";
import type { Language } from "../engine/types";

const start = async (message: string, language: Language = "en") => {
  const { response, journey } = await handleEvent("t", null, { kind: "start", sentToLlm: false, input: { audience: "consumer", language, openingMessage: message, incidentContent: null, incidentChannel: null, signals: { hasLink: false, linkVerdict: null, callWarning: null, callerSpoofed: false }, consent: { requires: [], preGranted: [] } } });
  return { screen: response.screen, facts: journey!.item.facts };
};

const did = (text: string, language: Language = "en") => offlineExtract({ userText: text, incidentText: "", language, incidentChannel: null, hasRiskyLink: false, audience: "consumer" }).userAlreadyDid;

describe("money that is already gone is understood, not turned away as off-topic", () => {
  it.each([
    "my wallet got drained",
    "someone drained my crypto wallet",
    "there are charges on my card I didn't make",
    "my money is gone from my account",
    "unauthorized transactions on my account",
  ])("%s", async (message) => {
    const { screen, facts } = await start(message);
    expect(screen.type).not.toBe("describe");
    expect(facts.userAlreadyDid).toContain("paid");
  });

  it("reads Finnish and Swedish money loss", () => {
    expect(did("rahat katosivat tililtäni", "fi")).toContain("paid");
    expect(did("tililläni on tuntemattomia veloituksia", "fi")).toContain("paid");
    expect(did("pengarna försvann från mitt konto", "sv")).toContain("paid");
  });

  it("keeps a real denial a denial", () => {
    expect(did("I didn't pay anything")).not.toContain("paid");
    expect(did("I did not transfer the money")).not.toContain("paid");
  });

  it("does not treat a stolen physical wallet as a transfer", () => {
    expect(did("my wallet was stolen on the bus")).not.toContain("paid");
  });

  it("does not call a vague wallet or crypto worry off-topic", async () => {
    for (const message of ["something weird with my wallet", "my crypto", "a seed phrase question"]) {
      const { screen } = await start(message);
      expect(screen.type === "describe" && "reason" in screen ? screen.reason : null).not.toBe("off_topic");
    }
  });
});
