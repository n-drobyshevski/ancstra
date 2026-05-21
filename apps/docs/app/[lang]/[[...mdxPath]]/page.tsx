import { generateStaticParamsFor, importPage } from 'nextra/pages';
import { notFound } from 'next/navigation';
import { useMDXComponents } from '../../../mdx-components';

export const generateStaticParams = generateStaticParamsFor('mdxPath');

const BASE_URL = (() => {
  const explicit = process.env.NEXT_PUBLIC_DOCS_URL;
  if (explicit) return explicit;
  const vercelProd = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${vercelProd}`;
  if (process.env.NODE_ENV === 'production') {
    console.error('[docs] NEXT_PUBLIC_DOCS_URL is not set — sitemap/canonical URLs will use localhost');
  }
  return 'http://localhost:3002';
})();

function pathFor(lang: string, mdxPath: string[] | undefined): string {
  const segments = mdxPath?.length ? mdxPath.join('/') : '';
  return `${BASE_URL}/${lang}${segments ? `/${segments}` : ''}`;
}

export async function generateMetadata(props: {
  params: Promise<{ lang: string; mdxPath?: string[] }>;
}) {
  const { lang, mdxPath } = await props.params;
  const page = await importPage(mdxPath, lang).catch((err: unknown) => {
    if (err instanceof Error && err.message?.startsWith('NEXT_HTTP_ERROR_FALLBACK')) throw err;
    return null;
  });
  if (!page) notFound();
  return {
    ...page.metadata,
    alternates: {
      canonical: pathFor(lang, mdxPath),
      languages: {
        en: pathFor('en', mdxPath),
        ru: pathFor('ru', mdxPath),
        'x-default': pathFor('en', mdxPath),
      },
    },
  };
}

const Wrapper = useMDXComponents().wrapper!;

export default async function Page(props: {
  params: Promise<{ lang: string; mdxPath?: string[] }>;
}) {
  const { lang, mdxPath } = await props.params;
  const result = await importPage(mdxPath, lang).catch((err: unknown) => {
    if (err instanceof Error && err.message?.startsWith('NEXT_HTTP_ERROR_FALLBACK')) throw err;
    return null;
  });
  if (!result) notFound();
  const { default: MDXContent, ...rest } = result;
  return (
    <Wrapper {...rest}>
      <MDXContent />
    </Wrapper>
  );
}
