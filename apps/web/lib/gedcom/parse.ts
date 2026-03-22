import * as parseGedcom from 'parse-gedcom';

import type { GedcomNode } from './types';

/**
 * Detect encoding from GEDCOM CHAR tag in the raw bytes.
 */
function detectEncoding(buffer: ArrayBuffer): string {
  const preview = new TextDecoder('ascii').decode(buffer.slice(0, 500));
  const charMatch = preview.match(/1\s+CHAR\s+(\S+)/i);
  if (!charMatch) return 'utf-8';

  const charset = charMatch[1].toUpperCase();
  if (charset === 'ANSI' || charset === 'ASCII') return 'windows-1252';
  if (charset === 'UNICODE') return 'utf-16le';
  return 'utf-8';
}

/**
 * Parse raw GEDCOM text into an AST via parse-gedcom.
 */
function parseGedcomText(text: string): GedcomNode[] {
  const result = parseGedcom.parse(text);
  return result as unknown as GedcomNode[];
}

/**
 * Parse a GEDCOM file (ArrayBuffer) into an AST.
 * Automatically detects encoding from the CHAR tag.
 */
export function parseGedcomFile(buffer: ArrayBuffer): GedcomNode[] {
  const encoding = detectEncoding(buffer);
  const text = new TextDecoder(encoding).decode(buffer);
  return parseGedcomText(text);
}

/**
 * Parse GEDCOM from a string (useful for testing).
 */
export function parseGedcomString(text: string): GedcomNode[] {
  return parseGedcomText(text);
}
