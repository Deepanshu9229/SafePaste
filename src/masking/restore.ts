// AI replies don't always copy tags exactly. Accepted forms for the tag [PERSON_1]:
//   [PERSON_1]  {PERSON_1}  [Person 1]  [ PERSON_1 ]  (in brackets: any case, "_" or space)
//   PERSON_1                                          (bare: any case, "_" only)
const TAG_PATTERN = /[[{]\s*([A-Za-z]+)[_ ](\d+)\s*[\]}]|\b([A-Za-z]+)_(\d+)\b/g;

/** Replace every tag found in `text` with its original value. Unknown tags are left as they are. */
export function restoreText(text: string, tagMap: Record<string, string>): string {
  return text.replace(
    TAG_PATTERN,
    (found, bracketType?: string, bracketNumber?: string, bareType?: string, bareNumber?: string) => {
      const type = (bracketType ?? bareType ?? "").toUpperCase();
      const number = bracketNumber ?? bareNumber;
      return tagMap[`[${type}_${number}]`] ?? found;
    },
  );
}
