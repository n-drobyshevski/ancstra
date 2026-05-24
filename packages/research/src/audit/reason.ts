/**
 * Bundle B 2026-05-24 — STR-3 reverse transitions require a non-empty reason
 * statement. This guard rejects empty/whitespace-only at the API boundary so
 * future bulk-script clients can't bypass the cultural primitive.
 *
 * See: docs/superpowers/specs/2026-05-24-research-flow-unification-bundle-b-design.md §6.1
 */

export class ReasonRequiredError extends Error {
  constructor(public opName: string, message: string) {
    super(`${opName}: ${message}`);
    this.name = 'ReasonRequiredError';
  }
}

export function requireReason(body: unknown, opName: string): string {
  if (!body || typeof body !== 'object') {
    throw new ReasonRequiredError(opName, 'request body is required');
  }
  const reason = (body as { reason?: unknown }).reason;
  if (typeof reason !== 'string') {
    throw new ReasonRequiredError(opName, 'reason must be a string');
  }
  const trimmed = reason.trim();
  if (trimmed.length < 1) {
    throw new ReasonRequiredError(opName, 'reason must be non-empty');
  }
  return trimmed;
}
