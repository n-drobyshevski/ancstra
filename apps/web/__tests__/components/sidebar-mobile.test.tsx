// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { installMatchMediaMock } from '../helpers/match-media-mock';

/**
 * Exercises the shadcn Sidebar primitive's mobile (Sheet) branch end-to-end:
 * trigger → open → dismiss paths. Uses a minimal Sidebar shell so the test
 * isolates the primitive's behaviour from AppSidebar's permission / lens /
 * auth dependencies (those are covered by their own tests).
 */
function Harness() {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={false}>
        <Sidebar collapsible="offcanvas">
          <SidebarHeader>
            <span>Brand</span>
          </SidebarHeader>
          <SidebarContent>
            {/* A plain element is enough — the test only asserts that drawer
                children render inside the dialog. Using a real Next route
                here trips @next/next/no-html-link-for-pages. */}
            <span data-testid="drawer-link">Dashboard</span>
          </SidebarContent>
        </Sidebar>
        <main>
          <SidebarTrigger data-testid="sidebar-trigger" />
        </main>
      </SidebarProvider>
    </TooltipProvider>
  );
}

describe('Sidebar mobile sheet', () => {
  beforeEach(() => {
    installMatchMediaMock(390); // iPhone 14 portrait
  });

  afterEach(() => {
    // Radix Dialog content is rendered in a portal — explicit cleanup avoids
    // leaking nodes between tests when assertions short-circuit.
    cleanup();
  });

  it('opens the drawer when the trigger is clicked', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByTestId('sidebar-trigger'));
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('renders drawer contents inside the dialog', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('sidebar-trigger'));
    expect(screen.getByTestId('drawer-link')).toBeDefined();
  });

  it('closes when Escape is pressed', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('sidebar-trigger'));
    expect(screen.queryByRole('dialog')).toBeDefined();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the dialog with the data-mobile attribute on the content', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('sidebar-trigger'));
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('data-mobile')).toBe('true');
  });

  it('uses the --sidebar-width-mobile token for sheet width', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('sidebar-trigger'));
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toMatch(/--sidebar-width-mobile/);
  });
});
