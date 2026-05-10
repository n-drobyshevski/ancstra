// jsdom does not implement window.matchMedia. This helper installs a minimal
// mock that evaluates "(min-width: Npx)" / "(max-width: Npx)" queries against
// a fixed viewport width — which is all the project's responsive hooks
// produce. Listeners are no-ops; reinstall the mock between tests to change
// the viewport. Shared between use-viewport tests and component tests that
// need to assert mobile-only rendering paths.
import { vi } from 'vitest';

export function installMatchMediaMock(width: number): void {
  function evaluate(query: string): boolean {
    const min = query.match(/\(min-width:\s*(\d+(?:\.\d+)?)px\)/);
    if (min) return width >= Number(min[1]);
    const max = query.match(/\(max-width:\s*(\d+(?:\.\d+)?)px\)/);
    if (max) return width <= Number(max[1]);
    return false;
  }
  function build(query: string): MediaQueryList {
    return {
      matches: evaluate(query),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
      onchange: null,
    } as unknown as MediaQueryList;
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation(build),
  });
}
