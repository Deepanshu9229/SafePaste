import { describe, expect, it } from "vitest";
import { detectAll } from "@/detectors/detectors";
import { maskText, type Entity } from "./mask";
import { restoreText } from "./restore";

// All IDs are synthetic.

function entitiesOf(text: string): Entity[] {
  return detectAll(text).map((match) => ({ ...match, masked: true }));
}

describe("maskText", () => {
  it("replaces each entity with a numbered tag and records the original", () => {
    const text = "PAN ABCPE1234F, call 9876543210.";
    const result = maskText(text, entitiesOf(text));

    expect(result.maskedText).toBe("PAN [PAN_1], call [PHONE_1].");
    expect(result.tagMap).toEqual({ "[PAN_1]": "ABCPE1234F", "[PHONE_1]": "9876543210" });
    expect(result.tags).toEqual(["[PAN_1]", "[PHONE_1]"]);
  });

  it("numbers each type separately, in order of appearance", () => {
    const text = "ABCPE1234F, XYZPK9876Q, 9876543210";
    expect(maskText(text, entitiesOf(text)).maskedText).toBe("[PAN_1], [PAN_2], [PHONE_1]");
  });

  it("gives the same tag to the same value written differently", () => {
    const text = "Aadhaar 2345 6789 0124 or 234567890124; phone +91 98765 43210 or 9876543210";
    const result = maskText(text, entitiesOf(text));

    expect(result.maskedText).toBe("Aadhaar [AADHAAR_1] or [AADHAAR_1]; phone [PHONE_1] or [PHONE_1]");
    expect(result.tagMap["[AADHAAR_1]"]).toBe("2345 6789 0124"); // first spelling wins
  });

  it("keeps unmasked entities visible and does not number them", () => {
    const text = "ABCPE1234F and XYZPK9876Q";
    const [first, second] = entitiesOf(text);
    const result = maskText(text, [{ ...first, masked: false }, second]);

    expect(result.maskedText).toBe("ABCPE1234F and [PAN_1]");
    expect(result.tags).toEqual([null, "[PAN_1]"]);
  });

  it("returns the text unchanged when nothing is masked", () => {
    expect(maskText("hello", [])).toEqual({ maskedText: "hello", tagMap: {}, tags: [] });
  });
});

describe("restoreText", () => {
  const tagMap = { "[PERSON_1]": "Priya Sharma", "[PAN_1]": "ABCPE1234F" };

  it.each([
    ["[PERSON_1]", "exact"],
    ["PERSON_1", "bare"],
    ["[Person 1]", "lowercase with space"],
    ["{PERSON_1}", "curly braces"],
    ["[ PERSON_1 ]", "inner spaces"],
    ["person_1", "bare lowercase"],
  ])("restores %s (%s)", (tag) => {
    expect(restoreText(`Dear ${tag},`, tagMap)).toBe("Dear Priya Sharma,");
  });

  it("restores several tags in one reply", () => {
    expect(restoreText("[PERSON_1]'s PAN is [PAN_1].", tagMap)).toBe("Priya Sharma's PAN is ABCPE1234F.");
  });

  it("leaves unknown tags and look-alikes alone", () => {
    expect(restoreText("[PERSON_2] and PAN_9", tagMap)).toBe("[PERSON_2] and PAN_9");
    expect(restoreText("Person 1 said hi", tagMap)).toBe("Person 1 said hi"); // bare form needs "_"
    expect(restoreText("my_PERSON_1", tagMap)).toBe("my_PERSON_1"); // part of a longer word
  });

  it("round-trips: mask then restore gives the original text", () => {
    const text = "PAN ABCPE1234F, Aadhaar 2345 6789 0124, mail priya@example.com, UPI priya@okaxis.";
    const { maskedText, tagMap: map } = maskText(text, entitiesOf(text));
    expect(restoreText(maskedText, map)).toBe(text);
  });
});
