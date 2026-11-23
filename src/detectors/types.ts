// Entity types found by the browser detectors. AI types (PERSON, ADDRESS) are added in W2.
export type EntityType =
  | "GSTIN"
  | "AADHAAR"
  | "CARD"
  | "PAN"
  | "UPI"
  | "EMAIL"
  | "PHONE";

export interface Match {
  type: EntityType;
  /** Index of the first character in the input text. */
  start: number;
  /** Index after the last character (like String.slice). */
  end: number;
  /** The exact text that was matched. */
  value: string;
}
