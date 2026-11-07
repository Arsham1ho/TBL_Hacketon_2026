import { describe, expect, it } from "vitest";
import { interpretConsentedSignal, readSimulatedSignal } from "../adapters/signals";

describe("consented signals", () => {
  it("reads a demo finding only for the selected scenario", () => {
    expect(readSimulatedSignal("operator_account.recent_logins", "unknown_login").finding).toBe("unfamiliar_login");
    expect(readSimulatedSignal("operator_account.recent_logins", "none").finding).toBe("unknown");
  });

  it("interprets a successful unfamiliar login without treating a familiar one as safe", () => {
    expect(interpretConsentedSignal("operator_account.recent_logins", [{ result: "success", device_known: false }])).toBe("unfamiliar_login");
    expect(interpretConsentedSignal("operator_account.recent_logins", [{ result: "success", device_known: true }])).toBe("unknown");
  });

  it("recognizes a recent simulated eSIM event", () => {
    expect(interpretConsentedSignal("subscription.recent_events", [{ type: "esim_activation" }])).toBe("recent_sim_change");
  });

  it("does not infer a former employee from a generic active staff account", () => {
    expect(interpretConsentedSignal("business.staff_accounts", [{ role: "employee", status: "active" }])).toBe("unknown");
  });
});
