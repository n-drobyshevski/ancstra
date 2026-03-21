// docs/architecture/patterns/pino-redaction.ts
// Integration target: apps/web/lib/logger.ts
//
// Addresses: AA-6 (API key management — never log API keys)

import pino from 'pino';

export const logger = pino({
  redact: {
    paths: [
      // Environment variables that may appear in logs
      'ANTHROPIC_API_KEY',
      'FAMILYSEARCH_API_KEY',
      'TRANSKRIBUS_API_KEY',
      'TURSO_AUTH_TOKEN',
      'SENTRY_DSN',

      // Request headers that may contain auth tokens
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',

      // Response headers
      'res.headers["set-cookie"]',

      // Nested objects
      '*.apiKey',
      '*.api_key',
      '*.token',
      '*.password',
      '*.secret',
    ],
    censor: '[REDACTED]',
  },
});
