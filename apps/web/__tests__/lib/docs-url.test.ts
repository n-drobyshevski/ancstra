import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { docsUrl } from '@/lib/docs-url';

describe('docsUrl', () => {
  const originalEnv = process.env.NEXT_PUBLIC_DOCS_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_DOCS_URL;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_DOCS_URL;
    } else {
      process.env.NEXT_PUBLIC_DOCS_URL = originalEnv;
    }
  });

  it('returns locale root with no path', () => {
    expect(docsUrl('en')).toBe('https://docs.ancstra.com/en');
    expect(docsUrl('ru')).toBe('https://docs.ancstra.com/ru');
  });

  it('appends path with single slash separator', () => {
    expect(docsUrl('en', 'getting-started')).toBe(
      'https://docs.ancstra.com/en/getting-started',
    );
    expect(docsUrl('ru', 'research/threads')).toBe(
      'https://docs.ancstra.com/ru/research/threads',
    );
  });

  it('strips leading and trailing slashes from path', () => {
    expect(docsUrl('en', '/getting-started/')).toBe(
      'https://docs.ancstra.com/en/getting-started',
    );
    expect(docsUrl('en', '//tree-view//')).toBe(
      'https://docs.ancstra.com/en/tree-view',
    );
  });

  it('respects NEXT_PUBLIC_DOCS_URL override', () => {
    process.env.NEXT_PUBLIC_DOCS_URL = 'http://localhost:3002';
    expect(docsUrl('ru', 'persons')).toBe(
      'http://localhost:3002/ru/persons',
    );
  });

  it('strips trailing slashes from NEXT_PUBLIC_DOCS_URL', () => {
    process.env.NEXT_PUBLIC_DOCS_URL = 'http://localhost:3002/';
    expect(docsUrl('ru')).toBe('http://localhost:3002/ru');
    expect(docsUrl('en', 'getting-started')).toBe('http://localhost:3002/en/getting-started');

    process.env.NEXT_PUBLIC_DOCS_URL = 'http://localhost:3002///';
    expect(docsUrl('en', 'tree-view')).toBe('http://localhost:3002/en/tree-view');
  });
});
