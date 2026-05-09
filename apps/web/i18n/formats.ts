import type { Formats } from 'next-intl';

export const formats = {
  dateTime: {
    short: { day: 'numeric', month: 'short', year: 'numeric' },
    long: { day: 'numeric', month: 'long', year: 'numeric' },
    time: { hour: 'numeric', minute: 'numeric' },
  },
  number: {
    integer: { maximumFractionDigits: 0 },
  },
} satisfies Formats;
