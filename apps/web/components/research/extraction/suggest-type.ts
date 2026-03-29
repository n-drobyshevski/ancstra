import type { FactType } from './types';

interface SuggestionRule {
  pattern: RegExp;
  type: FactType;
}

/**
 * Keyword rules applied to the text surrounding a selection.
 * Order matters — first match wins.
 */
const RULES: SuggestionRule[] = [
  { pattern: /\b(?:born|birth|b\.|nativity)\b/i, type: 'birth_date' },
  { pattern: /\b(?:birthplace|born\s+(?:in|at)|birth\s+place|place\s+of\s+birth)\b/i, type: 'birth_place' },
  { pattern: /\b(?:died|death|d\.|buried|interred|passed\s+away)\b/i, type: 'death_date' },
  { pattern: /\b(?:burial|cemetery|grave|death\s+place|place\s+of\s+death|died\s+(?:in|at))\b/i, type: 'death_place' },
  { pattern: /\b(?:married|marriage|m\.|wed|union|betrothed)\b/i, type: 'marriage_date' },
  { pattern: /\b(?:marriage\s+place|married\s+(?:in|at)|wedding\s+(?:in|at))\b/i, type: 'marriage_place' },
  { pattern: /\b(?:resided|residence|living\s+at|address|domicile)\b/i, type: 'residence' },
  { pattern: /\b(?:occupation|employed|worked\s+as|profession|trade|vocation)\b/i, type: 'occupation' },
  { pattern: /\b(?:immigrat|arrived|naturali|emigrat|passage|voyage)\b/i, type: 'immigration' },
  { pattern: /\b(?:served|enlisted|regiment|military|infantry|cavalry|army|navy|marines|veteran|rank|corps|battalion)\b/i, type: 'military_service' },
  { pattern: /\b(?:father|mother|parent|son\s+of|daughter\s+of)\b/i, type: 'parent_name' },
  { pattern: /\b(?:husband|wife|spouse)\b/i, type: 'spouse_name' },
  { pattern: /\b(?:children|child|son|daughter)\b/i, type: 'child_name' },
  { pattern: /\b(?:religion|church|congregation|denomination|faith|baptist|methodist|lutheran|catholic|presbyterian|quaker)\b/i, type: 'religion' },
  { pattern: /\b(?:ethnicity|ethnic|race|nationality)\b/i, type: 'ethnicity' },
];

/**
 * Given the text surrounding a user's selection, suggest the most likely fact type.
 * Returns null if no confident match found.
 *
 * @param surroundingText ~50 chars before and after the selection
 */
export function suggestFactType(surroundingText: string): FactType | null {
  for (const rule of RULES) {
    if (rule.pattern.test(surroundingText)) {
      return rule.type;
    }
  }
  return null;
}

/**
 * Extract surrounding context from a text body given a selection range.
 * Grabs ~80 chars before and after the selection for keyword matching.
 */
export function getSurroundingContext(
  fullText: string,
  selectionStart: number,
  selectionEnd: number,
  windowSize = 80,
): string {
  const before = fullText.slice(Math.max(0, selectionStart - windowSize), selectionStart);
  const after = fullText.slice(selectionEnd, selectionEnd + windowSize);
  return `${before} ${after}`;
}
