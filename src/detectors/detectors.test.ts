import { describe, expect, it } from "vitest";
import { gstinCheckChar, verhoeffCheckDigit } from "./checksums";
import { detectAll } from "./detectors";

// All IDs below are synthetic (made-up values that pass the checksums) or public test numbers.

/** [type, value] pairs, in text order. */
function found(text: string) {
  return detectAll(text).map((match) => [match.type, match.value]);
}

describe("GSTIN", () => {
  it("detects a GSTIN with a valid check character", () => {
    expect(found("GSTIN 29ABCPE1234F1Z7")).toEqual([["GSTIN", "29ABCPE1234F1Z7"]]);
  });

  it("does not also report the PAN inside it", () => {
    expect(found("29ABCPE1234F1Z7")).toHaveLength(1);
  });

  it("rejects a wrong check character", () => {
    expect(found("29ABCPE1234F1Z8")).toEqual([]);
  });

  it("rejects an unknown state code", () => {
    const base = "40ABCPE1234F1Z";
    expect(found(base + gstinCheckChar(base))).toEqual([]);
  });
});

describe("Aadhaar", () => {
  it.each(["2345 6789 0124", "234567890124", "2345-6789-0124"])("detects %s", (aadhaar) => {
    expect(found(`Aadhaar: ${aadhaar}`)).toEqual([["AADHAAR", aadhaar]]);
  });

  it("rejects a wrong check digit", () => {
    expect(found("2345 6789 0125")).toEqual([]);
  });

  it("rejects numbers starting with 0 or 1", () => {
    const base = "12345678901";
    expect(found(base + verhoeffCheckDigit(base))).toEqual([]);
  });

  it("rejects mixed separators", () => {
    expect(found("2345 6789-0124")).toEqual([]);
  });

  it("does not match the first 12 digits of a longer number", () => {
    const types = found("2345 6789 0124 5678").map(([type]) => type);
    expect(types).not.toContain("AADHAAR");
  });
});

describe("Card", () => {
  it.each([
    "4111 1111 1111 1111", // Visa test card
    "4111111111111111",
    "4111-1111-1111-1111",
    "3782 822463 10005", // Amex test card, 15 digits
  ])("detects %s", (card) => {
    expect(found(`Card ${card}`)).toEqual([["CARD", card]]);
  });

  it("rejects a number that fails Luhn", () => {
    expect(found("4111 1111 1111 1112")).toEqual([]);
  });

  it("rejects more than 19 digits", () => {
    expect(found("4111 1111 1111 1111 1111")).toEqual([]);
  });
});

describe("PAN", () => {
  it("detects a PAN", () => {
    expect(found("PAN: ABCPE1234F.")).toEqual([["PAN", "ABCPE1234F"]]);
  });

  it("rejects an invalid 4th letter", () => {
    expect(found("ABCXE1234F")).toEqual([]);
  });

  it("does not match inside a longer word", () => {
    expect(found("XABCPE1234F")).toEqual([]);
  });
});

describe("UPI", () => {
  it("detects name@handle", () => {
    expect(found("Pay priya.sharma@okaxis.")).toEqual([["UPI", "priya.sharma@okaxis"]]);
  });

  it("is case-insensitive", () => {
    expect(found("PRIYA@OKAXIS")).toEqual([["UPI", "PRIYA@OKAXIS"]]);
  });

  it("claims a phone-number UPI ID as one UPI match", () => {
    expect(found("9876543210@ybl")).toEqual([["UPI", "9876543210@ybl"]]);
  });

  it("leaves emails on a handle-like domain to the email detector", () => {
    expect(found("priya@paytm.com")).toEqual([["EMAIL", "priya@paytm.com"]]);
  });

  it("ignores unknown handles", () => {
    expect(found("priya@unknownbank")).toEqual([]);
  });
});

describe("Email", () => {
  it.each(["priya.sharma@example.com", "a.b+tag@mail.example.co.in"])("detects %s", (email) => {
    expect(found(`Mail ${email}.`)).toEqual([["EMAIL", email]]);
  });
});

describe("Phone", () => {
  it.each(["9876543210", "98765 43210", "98765-43210", "+91 98765 43210", "+919876543210", "09876543210"])(
    "detects %s",
    (phone) => {
      expect(found(`Call ${phone} today`)).toEqual([["PHONE", phone]]);
    },
  );

  it("rejects numbers starting with 0–5 after the prefix", () => {
    expect(found("5876543210")).toEqual([]);
  });

  it("rejects 11 digits without a prefix", () => {
    expect(found("98765432101")).toEqual([]);
  });
});

describe("detectAll", () => {
  it("finds every type in order, with correct positions", () => {
    const text =
      "Hi, I am Priya. PAN ABCPE1234F, Aadhaar 2345 6789 0124, call +91 98765 43210 " +
      "or mail priya@example.com. UPI priya@okaxis. GSTIN 29ABCPE1234F1Z7. Card 4111 1111 1111 1111.";

    const matches = detectAll(text);

    expect(matches.map((match) => [match.type, match.value])).toEqual([
      ["PAN", "ABCPE1234F"],
      ["AADHAAR", "2345 6789 0124"],
      ["PHONE", "+91 98765 43210"],
      ["EMAIL", "priya@example.com"],
      ["UPI", "priya@okaxis"],
      ["GSTIN", "29ABCPE1234F1Z7"],
      ["CARD", "4111 1111 1111 1111"],
    ]);
    for (const match of matches) {
      expect(text.slice(match.start, match.end)).toBe(match.value);
    }
  });

  it("returns nothing for text without IDs", () => {
    expect(detectAll("")).toEqual([]);
    expect(detectAll("Meeting at 10:30 on 12/05/2026, room 404.")).toEqual([]);
  });
});
