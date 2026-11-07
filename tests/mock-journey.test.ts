import { describe, expect, it } from "vitest";
import uiText from "../content/ui-text.json";
import type { ApiResponse } from "../engine/screens";
import { GatedSignal } from "../engine/types";
import { createClient } from "../lib/client";
import { demoScreen } from "../mocks/journey";

const response = (data: object, status = 200) => new Response(JSON.stringify(data), { status });

describe("session client", () => {
  it("sends the session id with every event after start", async () => {
    const calls: { url: string; body: any }[] = [];
    const client = createClient((async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      return response({ sessionId: "s1", screen: { type: "stop" } } as Partial<ApiResponse>);
    }) as typeof fetch);

    await client.send({ kind: "start", audience: "consumer", language: "auto", message: "help" });
    await client.send({ kind: "talk_to_person" });
    await client.end();

    expect(calls.map((call) => call.body.kind)).toEqual(["start", "talk_to_person", "end"]);
    expect(calls[0]?.body.sessionId).toBeUndefined();
    expect(calls[1]?.body.sessionId).toBe("s1");
    expect(await client.end()).toBeNull();
  });

  it("treats an error status as a failure", async () => {
    const client = createClient((async () => response({ error: "session_expired" }, 404)) as unknown as typeof fetch);
    await expect(client.send({ kind: "continue" })).rejects.toThrow("404");
  });
});

describe("review screens", () => {
  it("open by name", () => {
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
