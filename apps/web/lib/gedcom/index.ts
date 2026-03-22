export { parseGedcomFile, parseGedcomString } from './parse';
export { serializeToGedcom, type GedcomExportData, type GedcomExportEvent, type ExportMode } from './serialize';
export { serializeGedcom70 } from './serialize-70';

export type GedcomVersion = '5.5.1' | '7.0';

/**
 * Route to the appropriate GEDCOM serializer based on version.
 */
export function serializeGedcom(
  data: import('./serialize').GedcomExportData,
  options: { version: GedcomVersion; mode: import('./serialize').ExportMode },
): string {
  if (options.version === '7.0') {
    return serializeGedcom70(data, options.mode);
  }
  return serializeToGedcom(data, options.mode);
}
