export type AiEntityType = "PERSON" | "ADDRESS";

export interface AiEntity {
  type: AiEntityType;
  /** Exact text from the input. */
  text: string;
}

/** Maximum tokens the model may write for one scan. */
export const SCAN_NUM_PREDICT = 200;

// Kept short on purpose: every prompt token costs time on a 2-core CPU.
export const SCAN_SYSTEM_PROMPT = [
  "You find personal data in text. Reply with one JSON object per line and nothing else.",
  'For a person\'s name: {"type":"PERSON","text":"..."}',
  'For a postal address: {"type":"ADDRESS","text":"..."}',
  "Copy the text exactly as it is written in the input.",
  "Ignore placeholders in square brackets such as [PAN_1].",
  "If there are no names or addresses, reply with an empty line.",
].join("\n");

/** Words a model sometimes reports as names. Compared in lower case. */
const STOP_LIST = new Set([
  "i", "me", "my", "you", "he", "she", "they", "we", "us",
  "sir", "madam", "mr", "mrs", "ms", "dr",
  "team", "dear team", "customer", "user", "client", "manager", "colleague", "friend",
  "name", "address", "person", "none", "n/a", "india",
]);

/** A masking tag such as [PAN_1]: already masked, so never an entity. */
const TAG_PATTERN = /\[[A-Z]+_\d+\]/;

/**
 * Turns one line of model output into an entity, or null if the line is not usable.
 * Grounding check: the entity is kept only if its text appears word for word in `input`,
 * so the model cannot invent values.
 */
export function parseEntityLine(line: string, input: string): AiEntity | null {
  const trimmed = line.trim().replace(/,$/, "");
  if (!trimmed.startsWith("{")) return null;

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;

  const { type, text } = data as Record<string, unknown>;
  if (type !== "PERSON" && type !== "ADDRESS") return null;
  if (typeof text !== "string") return null;

  const value = text.trim();
  if (value.length < 2) return null;
  if (!input.includes(value)) return null;
  if (STOP_LIST.has(value.toLowerCase())) return null;
  if (TAG_PATTERN.test(value)) return null;

  return { type, text: value };
}
