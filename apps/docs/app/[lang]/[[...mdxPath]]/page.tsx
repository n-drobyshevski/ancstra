import { generateStaticParamsFor, importPage } from 'nextra/pages';
import { useMDXComponents } from '../../../mdx-components';

export const generateStaticParams = generateStaticParamsFor('mdxPath');

export async function generateMetadata(props: {
  params: Promise<{ lang: string; mdxPath?: string[] }>;
}) {
  const { lang, mdxPath } = await props.params;
  const { metadata } = await importPage(mdxPath, lang);
  return metadata;
}

const Wrapper = useMDXComponents().wrapper!;

export default async function Page(props: {
  params: Promise<{ lang: string; mdxPath?: string[] }>;
}) {
  const { lang, mdxPath } = await props.params;
  const result = await importPage(mdxPath, lang);
  const { default: MDXContent, ...rest } = result;
  return (
    <Wrapper {...rest}>
      <MDXContent />
    </Wrapper>
  );
}
