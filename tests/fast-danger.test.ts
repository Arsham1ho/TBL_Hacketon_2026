import { describe, expect, it } from "vitest";
import { fastDanger, fastDangerCheck } from "../engine/fast-danger";

describe("Fast Danger Check (fi, en, sv)", () => {
  it("exports fastDanger and fastDangerCheck identically", () => {
    expect(fastDanger).toBe(fastDangerCheck);
  });

  describe("personal safety priority", () => {
    it("detects English ex tracking", () => {
      expect(fastDanger("My ex-husband tracks my phone location")).toBe("personal_safety");
      expect(fastDanger("Someone installed spyware and is tracking my phone")).toBe("personal_safety");
    });

    it("detects Finnish ex monitoring", () => {
      expect(fastDanger("Ex-mieheni seuraa puhelintani ja tietää missä olen")).toBe("personal_safety");
      expect(fastDanger("Ex-vaimoni asensi vakoiluohjelman puhelimeeni")).toBe("personal_safety");
    });

    it("detects Swedish ex tracking", () => {
      expect(fastDanger("Mitt ex spårar min telefon")).toBe("personal_safety");
      expect(fastDanger("Min ex-man övervakar min telefon")).toBe("personal_safety");
    });

    it("detects medical emergency as personal safety", () => {
      expect(fastDanger("I need a doctor")).toBe("personal_safety");
      expect(fastDanger("Tarvitsen lääkärin heti")).toBe("personal_safety");
    });

    it("ignores ex-colleague", () => {
      expect(fastDanger("My ex-colleague emailed me an invoice")).toBeNull();
    });
  });

  describe("active ransomware", () => {
    it("detects ransomware in fi, en, sv without needing phone call", () => {
      expect(fastDanger("All my files are encrypted and they demand a ransom")).toBe("ransomware");
      expect(fastDanger("Kaikki tiedostot on salattu ja kiristysohjelma vaatii lunnaita")).toBe("ransomware");
      expect(fastDanger("Alla filerna är krypterade och de kräver lösensumma")).toBe("ransomware");
    });
  });

  describe("live danger requests in English", () => {
    it("detects remote access while on the phone", () => {
      expect(fastDanger("He is on the phone asking me to install AnyDesk")).toBe("remote_access");
      expect(fastDanger("Someone is calling right now asking for TeamViewer remote access")).toBe("remote_access");
    });

    it("detects app install while on the phone", () => {
      expect(fastDanger("Caller right now is asking me to install the security app")).toBe("app_install");
    });

    it("detects live code requests", () => {
      expect(fastDanger("He's on the line asking me to read out the verification code")).toBe("code");
      expect(fastDanger("Caller right now is asking for my SMS code")).toBe("code");
    });

    it("detects live money transfer", () => {
      expect(fastDanger("He is on the phone telling me to transfer money right now to a safe account")).toBe("money");
    });

    it("detects live card details request", () => {
      expect(fastDanger("Someone is calling me right now asking for my credit card number and cvv")).toBe("card");
    });

    it("detects live banking password request", () => {
      expect(fastDanger("He is on the line asking for my online banking login password")).toBe("login");
    });

    it("detects live impostor call", () => {
      expect(fastDanger("I'm on a phone call with someone pretending to be a police")).toBe("live_request");
    });
  });

  describe("live danger requests in Finnish", () => {
    it("detects remote access in Finnish", () => {
      expect(fastDanger("Soittaja on puhelimessa ja pyytää lataamaan AnyDesk etäyhteyden")).toBe("remote_access");
    });

    it("detects code request in Finnish", () => {
      expect(fastDanger("Mies soittaa parhaillaan ja pyytää lukemaan vahvistuskoodin ääneen")).toBe("code");
    });

    it("detects money transfer in Finnish", () => {
      expect(fastDanger("Soittaja on linjalla ja käskee siirtää rahat heti turvatilille")).toBe("money");
    });
  });

  describe("live danger requests in Swedish", () => {
    it("detects remote access in Swedish", () => {
      expect(fastDanger("En person sitter i telefonen nu och ber om fjärråtkomst med TeamViewer")).toBe("remote_access");
    });

    it("detects code request in Swedish", () => {
      expect(fastDanger("Han är i telefonen just nu och ber mig läsa upp sms-koden")).toBe("code");
    });
  });

  describe("no live indicator / quiet cases", () => {
    it("stays quiet on old or passive messages without live indicators", () => {
      expect(fastDanger("I received a suspicious SMS yesterday asking to click a link")).toBeNull();
      expect(fastDanger("Sain oudon tekstiviestin Postilta kaksi tuntia sitten")).toBeNull();
    });

    it("stays quiet on self-initiated actions", () => {
      expect(fastDanger("I called the bank myself and they are asking for my card number on the phone")).toBeNull();
      expect(fastDanger("I booked IT support and they called to connect with AnyDesk")).toBeNull();
    });

    it("stays quiet when negated", () => {
      expect(fastDanger("He was on the phone but I refused and did not give the verification code")).toBeNull();
      expect(fastDanger("Soittaja oli puhelimessa mutta en antanut koodia")).toBeNull();
    });
  });
});

