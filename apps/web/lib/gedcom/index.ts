export { parseGedcomFile, parseGedcomString } from './parse';
export { serializeToGedcom, type GedcomExportData, type GedcomExportEvent, type ExportMode } from './serialize';
export { serializeGedcom70 } from './serialize-70';

import { serializeToGedcom as _serializeToGedcom } from './serialize';
import { serializeGedcom70 as _serializeGedcom70 } from './serialize-70';

export type GedcomVersion = '5.5.1' | '7.0';

/**
 * Route to the appropriate GEDCOM serializer based on version.
 */
export function serializeGedcom(
  data: import('./serialize').GedcomExportData,
  options: { version: GedcomVersion; mode: import('./serialize').ExportMode },
): string {
  if (options.version === '7.0') {
    return _serializeGedcom70(data, options.mode);
  }
  return _serializeToGedcom(data, options.mode);
}
