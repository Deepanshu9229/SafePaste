// GSTIN…PHONE are found by the browser detectors; PERSON and ADDRESS by the AI scan;
// REDACTED is text the user selected and masked by hand.
export type EntityType =
  | "GSTIN"
  | "AADHAAR"
  | "CARD"
  | "PAN"
  | "UPI"
  | "EMAIL"
  | "PHONE"
  | "PERSON"
  | "ADDRESS"
  | "REDACTED";

export interface Match {
  type: EntityType;
  /** Index of the first character in the input text. */
  start: number;
  /** Index after the last character (like String.slice). */
  end: number;
  /** The exact text that was matched. */
  value: string;
}
