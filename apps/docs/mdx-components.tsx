import { useMDXComponents as getThemeComponents } from 'nextra-theme-docs';
import { Callout } from 'nextra/components';
import type { MDXComponents } from 'nextra/mdx-components';
import type { JSX } from 'react';

type ThemeMDXComponents = ReturnType<typeof getThemeComponents>;
type WrapperProps = Parameters<NonNullable<ThemeMDXComponents['wrapper']>>[0];

const BANNER_STRINGS = {
  en: 'This page was machine-translated. Edits and corrections are welcome — open a PR or issue.',
  ru: 'Эта страница переведена машинным способом. Правки и улучшения приветствуются — отправьте PR или issue.',
};

function MachineTranslationBanner({ locale }: { locale: 'en' | 'ru' }): JSX.Element {
  return (
    <Callout type="warning" emoji="⚠️">
      {BANNER_STRINGS[locale]}
    </Callout>
  );
}

function detectLocale(filePath: string): 'en' | 'ru' {
  return filePath.includes('/content/ru/') ? 'ru' : 'en';
}

function isMachineTranslated(metadata: WrapperProps['metadata']): boolean {
  // Nextra merges all YAML frontmatter fields directly into the metadata export.
  // `translation` is a custom field — not typed on $NextraMetadata, so we cast.
  const translation = (metadata as Record<string, unknown>)['translation'];
  if (translation === null || typeof translation !== 'object') return false;
  return (translation as Record<string, unknown>)['status'] === 'machine';
}

export function useMDXComponents(components?: MDXComponents): ThemeMDXComponents {
  const themeComponents = getThemeComponents(components);
  const ThemeWrapper = themeComponents.wrapper;
  if (!ThemeWrapper) return themeComponents;

  const WrappedWithBanner = (props: WrapperProps): JSX.Element => {
    const filePath = props.metadata.filePath ?? '';
    const locale = detectLocale(filePath);
    const showBanner = isMachineTranslated(props.metadata);
    return (
      <ThemeWrapper {...props}>
        {showBanner ? <MachineTranslationBanner locale={locale} /> : null}
        {props.children}
      </ThemeWrapper>
    );
  };

  return { ...themeComponents, wrapper: WrappedWithBanner };
}
