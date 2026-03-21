// docs/architecture/patterns/sentry-config.ts
// Integration target: apps/web/sentry.client.config.ts and apps/web/sentry.server.config.ts
//
// Addresses: DF-3 (Sentry may capture PII in error events)

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Strip PII from all events before sending to Sentry
  beforeSend(event) {
    // Strip query parameters from URLs (may contain person names)
    if (event.request?.url) {
      const url = new URL(event.request.url);
      url.search = ''; // Remove all query params
      event.request.url = url.toString();
    }

    // Strip request body (may contain person data in POST/PUT)
    if (event.request?.data) {
      event.request.data = '[REDACTED]';
    }

    // Strip query strings from breadcrumb URLs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
        if (breadcrumb.data?.url) {
          try {
            const url = new URL(breadcrumb.data.url);
            url.search = '';
            breadcrumb.data.url = url.toString();
          } catch {
            // Not a valid URL, leave as-is
          }
        }
        return breadcrumb;
      });
    }

    return event;
  },

  // Do not send user PII
  beforeSendTransaction(event) {
    if (event.request?.url) {
      const url = new URL(event.request.url);
      url.search = '';
      event.request.url = url.toString();
    }
    return event;
  },
});

// IMPORTANT: Exception messages may contain PII (e.g., "Person 'Maria Schmidt' not found").
// Establish convention: error messages must use IDs, never person names.
// Example: throw new Error(`Person not found: ${personId}`) — NOT `Person '${name}' not found`
// During integration, consider adding exception message scrubbing to beforeSend
// if this convention cannot be guaranteed.
