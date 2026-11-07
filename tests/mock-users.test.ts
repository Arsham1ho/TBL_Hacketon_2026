import { describe, expect, it } from "vitest";
import { authenticateUser, getUserById, MOCK_USERS } from "../lib/mock-users";

describe("Mock Users and Authentication", () => {
  it("defines both regular customer and small business test users", () => {
    expect(MOCK_USERS).toHaveLength(2);
    const consumer = MOCK_USERS.find((u) => u.type === "consumer");
    const business = MOCK_USERS.find((u) => u.type === "small_business");

    expect(consumer).toBeDefined();
    expect(business).toBeDefined();

    expect(consumer?.personal.primaryBank).toBeTruthy();
    expect(consumer?.personal.registeredDevices.length).toBeGreaterThan(0);

    expect(business?.business).toBeDefined();
    expect(business?.business?.businessId).toBeTruthy();
    expect(business?.business?.corporateBank).toBeTruthy();
  });

  it("authenticates the regular customer with username or email", () => {
    const user1 = authenticateUser("customer", "customer123");
    expect(user1).toBeDefined();
    expect(user1?.type).toBe("consumer");
    expect(user1?.name).toBe("Emma Korhonen");

    const user2 = authenticateUser("emma", "customer123");
    expect(user2?.id).toBe(user1?.id);

    const user3 = authenticateUser("emma.korhonen@example.fi", "customer123");
    expect(user3?.id).toBe(user1?.id);
  });

  it("authenticates the small business user with username or email", () => {
    const user1 = authenticateUser("business", "business123");
    expect(user1).toBeDefined();
    expect(user1?.type).toBe("small_business");
    expect(user1?.business?.companyName).toBe("Virtanen Design & Consulting Oy");

    const user2 = authenticateUser("mikko", "business123");
    expect(user2?.id).toBe(user1?.id);

    const user3 = authenticateUser("mikko.virtanen@virtanendesign.fi", "business123");
    expect(user3?.id).toBe(user1?.id);
  });

  it("rejects invalid username or password", () => {
    expect(authenticateUser("unknown", "customer123")).toBeNull();
    expect(authenticateUser("customer", "wrongpass")).toBeNull();
    expect(authenticateUser("business", "wrongpass")).toBeNull();
    expect(authenticateUser("", "")).toBeNull();
  });

  it("retrieves user by id", () => {
    expect(getUserById("user-consumer-01")?.name).toBe("Emma Korhonen");
    expect(getUserById("user-business-01")?.name).toBe("Mikko Virtanen");
    expect(getUserById("invalid-id")).toBeNull();
  });
});
