import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import 'nextra-theme-docs/style.css';
import { notFound } from 'next/navigation';
import type { PageMapItem } from 'nextra';
import type { ReactNode } from 'react';

const LOCALES = ['en', 'ru'] as const;
type Locale = (typeof LOCALES)[number];

const UI: Record<Locale, { brand: string; footer: string }> = {
  en: {
    brand: 'Ancstra Docs',
    footer: 'Ancstra — AI-Powered Personal Genealogy',
  },
  ru: {
    brand: 'Ancstra Docs',
    footer: 'Ancstra — ИИ-помощник для семейной истории',
  },
};

export const metadata = {
  title: { default: 'Ancstra Docs', template: '%s — Ancstra Docs' },
  description: 'Documentation for Ancstra — AI-Powered Personal Genealogy',
};

export async function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export default async function LangLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!LOCALES.includes(lang as Locale)) notFound();
  const locale = lang as Locale;
  // Nextra's ConfigProvider crashes when pageMap[0] is undefined, which happens
  // when a locale has no translated pages yet (empty pageMap) or only empty
  // folder stubs (e.g. a research/_meta.ts with no sibling MDX files).
  // Fall back to the EN page map so the Layout renders cleanly; the page
  // component will still call notFound() for missing locale content.
  function stripEmptyFolders(items: PageMapItem[]): PageMapItem[] {
    return items.flatMap((item) => {
      if ('children' in item) {
        const children = stripEmptyFolders(item.children as PageMapItem[]);
        return children.length > 0 ? [{ ...item, children }] : [];
      }
      return [item];
    });
  }
  const rawPageMap = await getPageMap(`/${locale}`);
  const localePageMap = stripEmptyFolders(rawPageMap);
  const pageMap = localePageMap.length > 0 ? localePageMap : await getPageMap('/en');

  return (
    <html lang={locale} dir="ltr" suppressHydrationWarning>
      <Head
        faviconGlyph="🌳"
        color={{
          hue: 240,
          saturation: 50,
          lightness: { light: 38, dark: 55 },
        }}
        backgroundColor={{
          light: 'rgb(244,244,249)',
          dark: 'rgb(20,21,28)',
        }}
      />
      <body>
        <Layout
          navbar={
            <Navbar logo={<span style={{ fontWeight: 700 }}>{UI[locale].brand}</span>} />
          }
          pageMap={pageMap}
          i18n={[
            { locale: 'en', name: 'English' },
            { locale: 'ru', name: 'Русский' },
          ]}
          footer={<Footer>{UI[locale].footer}</Footer>}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
