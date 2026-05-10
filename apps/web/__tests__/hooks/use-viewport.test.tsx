// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIsMobile, useViewport, BREAKPOINTS } from '@/hooks/use-viewport';
import { installMatchMediaMock } from '../helpers/match-media-mock';

beforeEach(() => {
  installMatchMediaMock(1280);
});

describe('useIsMobile / useViewport', () => {
  it('reports isMobile=true at 390px (iPhone 14 portrait)', () => {
    installMatchMediaMock(390);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('reports isMobile=true at 412px (Pixel 7 portrait)', () => {
    installMatchMediaMock(412);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('reports isMobile=true at 430px (iPhone 15 Pro Max portrait)', () => {
    installMatchMediaMock(430);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('reports isMobile=true at the xs boundary (480px exactly)', () => {
    installMatchMediaMock(BREAKPOINTS.xs);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('reports isMobile=true just below md (767px)', () => {
    installMatchMediaMock(BREAKPOINTS.md - 1);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('reports isMobile=false at md (768px — tablet)', () => {
    installMatchMediaMock(BREAKPOINTS.md);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('reports isMobile=false at lg (1024px — desktop)', () => {
    installMatchMediaMock(BREAKPOINTS.lg);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('useViewport classifies a 390px viewport as mobile only', () => {
    installMatchMediaMock(390);
    const { result } = renderHook(() => useViewport());
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
  });
});
