'use client';

import { useReportWebVitals } from 'next/web-vitals';
import * as Sentry from '@sentry/nextjs';

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    Sentry.metrics.distribution(metric.name, metric.value, {
      unit: 'millisecond',
      attributes: {
        rating: metric.rating,
        navigationType: metric.navigationType,
      },
    });
  });

  return null;
}
