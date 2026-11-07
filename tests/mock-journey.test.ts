import { describe, expect, it } from "vitest";
import uiText from "../content/ui-text.json";
import { GatedSignal } from "../engine/types";
import { createMockClient, demoScreen } from "../mocks/journey";

describe("mock journey", () => {
  it("walks from the Stop Screen to the end of a full journey", async () => {
    const client = createMockClient();
    const types: string[] = [];
    const step = async (request: Parameters<typeof client.send>[0]) => types.push((await client.send(request)).screen.type);

    await step({ kind: "start", audience: "consumer", language: "en", message: "help" });
    await step({ kind: "continue" });
    await step({ kind: "answer", topic: "card_details_entered", answer: "yes" });
    await step({ kind: "consent", signal: "subscription.recent_events", granted: true });
    await step({ kind: "rescue", stepId: "a", outcome: "done" });
    await step({ kind: "rescue", stepId: "b", outcome: "not_possible" });
    await step({ kind: "rescue", stepId: "c", outcome: "done" });
    await step({ kind: "handoff", approved: true });

    types.push((await client.end()).screen.type);

    expect(types).toEqual(["stop", "flip", "unlock", "rescue", "rescue", "rescue", "handoff", "handoff", "end"]);
  });

  it("gives a conditional result when the user is not sure", async () => {
    const response = await createMockClient().send({ kind: "answer", topic: "card_details_entered", answer: "unsure" });
    expect(response.screen).toMatchObject({ type: "result" });
    expect(response.screen.type === "result" && response.screen.branches?.length).toBe(2);
    expect(response.state.status).toBe("needs_verification");
  });

  it("offers a talk-to-a-person route from any step", async () => {
    const response = await createMockClient().send({ kind: "talk_to_person" });
    expect(response.screen.type).toBe("handoff");
  });

  it("opens every review screen by name", () => {
    for (const name of ["stop", "flip", "unlock", "rescue", "handoff", "fallback", "end", "threat", "unsure", "safe"]) {
      expect(demoScreen(name)).not.toBeNull();
    }
    expect(demoScreen("missing")).toBeNull();
  });
});

describe("interface text", () => {
  it("has Finnish, English and Swedish for every key", () => {
    for (const [key, value] of Object.entries(uiText)) {
      expect(Object.keys(value).sort(), key).toEqual(["en", "fi", "sv"]);
      if (key !== "_review") expect(Object.values(value).every(Boolean), key).toBe(true);
    }
  });

  it("names every gated signal in plain language", () => {
    for (const signal of GatedSignal.options) expect(uiText).toHaveProperty([signal]);
  });
});
