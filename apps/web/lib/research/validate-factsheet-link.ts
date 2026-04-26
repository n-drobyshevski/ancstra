import {
  validateNoSelfRef,
  validateNoDuplicate,
  type ConnectionViolation,
} from '@/lib/graph/validate-connection';
import type { FactsheetLink } from './factsheet-client';

export type FactsheetRelationshipType = FactsheetLink['relationshipType'];

/**
 * Factsheet links are presented as type-agnostic in the UI: two factsheets are
 * connected or they are not. The schema still requires a `relationshipType`
 * value, so manual links default to this neutral placeholder. Suggestion-derived
 * links keep their fact-derived type.
 */
export const DEFAULT_LINK_TYPE: FactsheetRelationshipType = 'parent_child';

interface ValidateFactsheetLinkArgs {
  source: string;
  target: string;
  links: readonly FactsheetLink[];
}

export function validateFactsheetLink(
  args: ValidateFactsheetLinkArgs,
): ConnectionViolation | null {
  const { source, target, links } = args;

  const selfRef = validateNoSelfRef(source, target);
  if (selfRef) return selfRef;

  // Treat any existing link between the pair as a duplicate, regardless of
  // direction or stored relationshipType — the UI no longer distinguishes them.
  const duplicate = validateNoDuplicate(
    source,
    target,
    'any',
    links,
    (link) => ({
      from: link.fromFactsheetId,
      to: link.toFactsheetId,
      type: 'any',
      symmetric: true,
    }),
  );
  if (duplicate) return duplicate;

  return null;
}

export function formatFactsheetViolation(violation: ConnectionViolation): string {
  switch (violation.kind) {
    case 'self_reference':
      return 'Cannot link a factsheet to itself';
    case 'duplicate':
      return 'These factsheets are already linked';
    case 'cycle':
      return 'This would create a circular relationship';
  }
}
