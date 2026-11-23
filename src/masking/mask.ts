import type { Match } from "@/detectors/types";

/** A detected match plus the user's choice to mask it or keep it visible. */
export interface Entity extends Match {
  masked: boolean;
}

export interface MaskResult {
  /** Input text with every masked entity replaced by its tag. */
  maskedText: string;
  /** Tag → original value, e.g. { "[PAN_1]": "ABCPE1234F" }. Never leaves the browser. */
  tagMap: Record<string, string>;
  /** Tag for each entity, same order as the input; null when the entity is not masked. */
  tags: (string | null)[];
}

/** Same value written differently gets the same tag (e.g. Aadhaar with or without spaces). */
function normalizedValue(match: Match): string {
  switch (match.type) {
    case "AADHAAR":
    case "CARD":
      return match.value.replace(/\D/g, "");
    case "PHONE":
      return match.value.replace(/\D/g, "").slice(-10); // drop +91 / 0
    case "EMAIL":
    case "UPI":
      return match.value.toLowerCase();
    default:
      return match.value;
  }
}

/**
 * Replace masked entities with [TYPE_n] tags, one tag per distinct value,
 * numbered per type in order of first appearance.
 * `entities` must be sorted by `start` and must not overlap (detectAll guarantees both).
 */
export function maskText(text: string, entities: Entity[]): MaskResult {
  const tagMap: Record<string, string> = {};
  const tagByValue = new Map<string, string>();
  const countByType = new Map<string, number>();
  const tags: (string | null)[] = [];
  let maskedText = "";
  let cursor = 0;

  for (const entity of entities) {
    if (!entity.masked) {
      tags.push(null);
      continue;
    }

    const key = `${entity.type}:${normalizedValue(entity)}`;
    let tag = tagByValue.get(key);
    if (!tag) {
      const count = (countByType.get(entity.type) ?? 0) + 1;
      countByType.set(entity.type, count);
      tag = `[${entity.type}_${count}]`;
      tagByValue.set(key, tag);
      tagMap[tag] = entity.value;
    }

    tags.push(tag);
    maskedText += text.slice(cursor, entity.start) + tag;
    cursor = entity.end;
  }

  maskedText += text.slice(cursor);
  return { maskedText, tagMap, tags };
}
