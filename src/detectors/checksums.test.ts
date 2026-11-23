import { describe, expect, it } from "vitest";
import {
  gstinCheckChar,
  isValidGstinChecksum,
  isValidLuhn,
  isValidVerhoeff,
  verhoeffCheckDigit,
} from "./checksums";

// Reference vectors are from the algorithm descriptions (Wikipedia) or worked out by hand.
// All IDs are synthetic.

describe("Verhoeff", () => {
  it("computes known check digits", () => {
    expect(verhoeffCheckDigit("236")).toBe(3);
    expect(verhoeffCheckDigit("12345")).toBe(1);
  });

  it("accepts numbers with a correct check digit", () => {
    expect(isValidVerhoeff("2363")).toBe(true);
    expect(isValidVerhoeff("123451")).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    expect(isValidVerhoeff("2364")).toBe(false);
    expect(isValidVerhoeff("123450")).toBe(false);
  });

  it("catches swapped neighbouring digits", () => {
    expect(isValidVerhoeff("3263")).toBe(false);
  });

  it("round-trips: digits + generated check digit is valid", () => {
    const base = "23456789012";
    expect(isValidVerhoeff(base + verhoeffCheckDigit(base))).toBe(true);
  });
});

describe("Luhn", () => {
  it("accepts known valid numbers", () => {
    expect(isValidLuhn("79927398713")).toBe(true);
    expect(isValidLuhn("4111111111111111")).toBe(true); // Visa test card
    expect(isValidLuhn("5555555555554444")).toBe(true); // Mastercard test card
    expect(isValidLuhn("378282246310005")).toBe(true); // Amex test card
  });

  it("rejects a changed digit", () => {
    expect(isValidLuhn("79927398710")).toBe(false);
    expect(isValidLuhn("4111111111111112")).toBe(false);
  });
});

describe("GSTIN check character", () => {
  // Worked by hand: sum of digits of (value × 1 or 2) in base 36, then (36 − sum % 36) % 36.
  it("computes check characters", () => {
    expect(gstinCheckChar("29ABCDE1234F1Z")).toBe("W");
    expect(gstinCheckChar("29ABCPE1234F1Z")).toBe("7");
  });

  it("validates the 15th character", () => {
    expect(isValidGstinChecksum("29ABCPE1234F1Z7")).toBe(true);
    expect(isValidGstinChecksum("29ABCPE1234F1Z8")).toBe(false);
    expect(isValidGstinChecksum("29ABCPE1234F1Z")).toBe(false); // too short
  });
});
