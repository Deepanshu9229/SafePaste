import { isValidGstinChecksum, isValidLuhn, isValidVerhoeff } from "./checksums";
import type { EntityType, Match } from "./types";

interface Detector {
  type: EntityType;
  /** Must have the `g` flag. Lookarounds stop matches inside longer words or numbers. */
  pattern: RegExp;
  /** Extra check on the matched text (e.g. a checksum). */
  isValid?: (value: string) => boolean;
}

/** GSTIN state codes: 01–38, 97 (Other Territory), 99 (Centre Jurisdiction). */
function isValidGstinStateCode(code: number): boolean {
  return (code >= 1 && code <= 38) || code === 97 || code === 99;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Common UPI handles (the part after @). Extend as needed. */
const UPI_HANDLES = [
  "okaxis", "okhdfcbank", "okicici", "oksbi",
  "ybl", "ibl", "axl",
  "paytm", "ptyes", "ptaxis", "pthdfc", "ptsbi",
  "apl", "yapl", "rapl",
  "upi", "axisbank", "hdfcbank", "icici", "sbi", "kotak", "kmbl",
  "idfcfirst", "indus", "yesbank", "aubank", "barodampay",
  "freecharge", "jupiteraxis", "fbl", "airtel", "jio",
  "waaxis", "wahdfcbank", "waicici", "wasbi",
];

/** Run in this order: an earlier detector wins when matches overlap. */
export const DETECTORS: Detector[] = [
  {
    // 2-digit state code + PAN + entity number + "Z" + check character, e.g. 29ABCPE1234F1Z7.
    type: "GSTIN",
    pattern: /(?<![A-Za-z0-9])\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z](?![A-Za-z0-9])/g,
    isValid: (value) =>
      isValidGstinStateCode(Number(value.slice(0, 2))) && isValidGstinChecksum(value),
  },
  {
    // 12 digits, first 2–9, optional groups of 4 with one consistent separator.
    // Not part of a longer number (e.g. the first 12 digits of a card).
    type: "AADHAAR",
    pattern: /(?<![A-Za-z0-9+]|\d[ -])[2-9]\d{3}([ -]?)\d{4}\1\d{4}(?![A-Za-z0-9]|[ -]\d)/g,
    isValid: (value) => isValidVerhoeff(digitsOnly(value)),
  },
  {
    // 13–19 digits, optionally separated by single spaces or hyphens.
    type: "CARD",
    pattern: /(?<![A-Za-z0-9+]|\d[ -])\d(?:[ -]?\d){12,18}(?![A-Za-z0-9]|[ -]\d)/g,
    isValid: (value) => isValidLuhn(digitsOnly(value)),
  },
  {
    // AAAAA9999A; the 4th letter is the holder type (P person, C company, H HUF, …).
    type: "PAN",
    pattern: /(?<![A-Za-z0-9])[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z](?![A-Za-z0-9])/g,
  },
  {
    // name@handle with a known handle. Not followed by ".com" etc. (that is an email).
    type: "UPI",
    pattern: new RegExp(
      `(?<![A-Za-z0-9._-])[A-Za-z0-9._-]{2,256}@(?:${UPI_HANDLES.join("|")})(?![A-Za-z0-9-]|\\.[A-Za-z0-9])`,
      "gi",
    ),
  },
  {
    type: "EMAIL",
    pattern:
      /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(?![A-Za-z0-9-])/g,
  },
  {
    // Indian mobile: optional +91 / 91 / 0, then 10 digits starting 6–9 (optionally 5 + 5).
    type: "PHONE",
    pattern: /(?<![A-Za-z0-9+])(?:\+91[ -]?|91[ -]|0)?[6-9]\d{4}[ -]?\d{5}(?![A-Za-z0-9])/g,
  },
];

function findMatches(text: string, detector: Detector): Match[] {
  const matches: Match[] = [];
  for (const result of text.matchAll(detector.pattern)) {
    const value = result[0];
    if (detector.isValid && !detector.isValid(value)) continue;
    matches.push({ type: detector.type, start: result.index, end: result.index + value.length, value });
  }
  return matches;
}

function overlaps(a: Match, b: Match): boolean {
  return a.start < b.end && b.start < a.end;
}

/** All structured IDs in `text`, sorted by position. Overlaps go to the earlier detector. */
export function detectAll(text: string): Match[] {
  const accepted: Match[] = [];
  for (const detector of DETECTORS) {
    for (const match of findMatches(text, detector)) {
      if (!accepted.some((other) => overlaps(match, other))) accepted.push(match);
    }
  }
  return accepted.sort((a, b) => a.start - b.start);
}
