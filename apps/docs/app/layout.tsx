import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import 'nextra-theme-docs/style.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Ancstra Docs',
  description: 'Documentation for Ancstra — AI-Powered Personal Genealogy',
};

const navbar = <Navbar logo={<span style={{ fontWeight: 700 }}>Ancstra Docs</span>} />;
const footer = <Footer>Ancstra — AI-Powered Personal Genealogy</Footer>;

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
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
          navbar={navbar}
          pageMap={await getPageMap()}
          footer={footer}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
