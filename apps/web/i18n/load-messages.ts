import { NAMESPACES } from './namespaces';
import type { Locale } from './routing';

type MessagesByNamespace = Record<string, unknown>;

export async function loadMessages(locale: Locale): Promise<MessagesByNamespace> {
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => {
      const mod = await import(`../messages/${locale}/${ns}.json`);
      return [ns, mod.default] as const;
    }),
  );
  return Object.fromEntries(entries);
}
