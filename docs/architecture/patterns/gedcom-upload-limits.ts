// docs/architecture/patterns/gedcom-upload-limits.ts
// Integration target: packages/gedcom/parser/ and apps/web/app/api/import/
//
// Addresses: IS-4 (GEDCOM as attack vector)

/** Maximum GEDCOM file size: 50MB */
export const MAX_GEDCOM_FILE_SIZE = 50 * 1024 * 1024;

/** Maximum nesting depth for GEDCOM records */
export const MAX_GEDCOM_DEPTH = 50;

/** Maximum number of persons in a single import */
export const MAX_PERSONS_PER_IMPORT = 100_000;

/** Maximum closure table rebuild iterations (prevents circular reference loops) */
export const MAX_CLOSURE_TABLE_ITERATIONS = 500_000;

/**
 * Validate a GEDCOM file before parsing.
 * Call this before passing the file to the parser.
 */
export function validateGedcomUpload(file: File | Buffer, fileName: string): {
  valid: boolean;
  error?: string;
} {
  // 1. File size check
  const size = file instanceof File ? file.size : file.byteLength;
  if (size > MAX_GEDCOM_FILE_SIZE) {
    return { valid: false, error: `File exceeds maximum size of ${MAX_GEDCOM_FILE_SIZE / 1024 / 1024}MB` };
  }

  // 2. File extension check
  if (!fileName.toLowerCase().endsWith('.ged')) {
    return { valid: false, error: 'File must have .ged extension' };
  }

  // 3. MIME type check (if available)
  if (file instanceof File && file.type && file.type !== 'text/plain' && file.type !== 'application/x-gedcom') {
    return { valid: false, error: `Unexpected MIME type: ${file.type}` };
  }

  return { valid: true };
}

/**
 * Validate a GEDCOM string value for dangerous content.
 * Addresses: IS-3 (input sanitization)
 *
 * IMPORTANT: Do NOT HTML-encode values before storing in the database.
 * React JSX escapes output by default, so storing encoded entities
 * causes double-encoding. Instead:
 * - Store raw values in the database
 * - React JSX auto-escapes on render (safe by default)
 * - Never use raw innerHTML with user data
 *
 * This function strips truly dangerous content (script tags, event handlers)
 * while preserving legitimate characters like & < > in genealogical data
 * (e.g., "Smith & Sons", "Born < 1800").
 */
export function sanitizeGedcomValue(value: string): string {
  return value
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handler attributes (onclick, onerror, etc.)
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: protocol URLs
    .replace(/javascript\s*:/gi, '');
}

/**
 * Check for media path traversal in GEDCOM FILE references.
 * GEDCOM files can reference media via relative paths.
 *
 * Note: Also decode URL-encoded sequences before checking, as %2e%2e
 * could bypass naive string checks.
 */
export function isPathTraversalSafe(filePath: string): boolean {
  // Decode URL-encoded characters first
  const decoded = decodeURIComponent(filePath);
  const normalized = decoded.replace(/\\/g, '/');
  // Reject null bytes (can bypass path checks in some systems)
  if (normalized.includes('\0')) return false;
  return !normalized.includes('..') && !normalized.startsWith('/');
}
