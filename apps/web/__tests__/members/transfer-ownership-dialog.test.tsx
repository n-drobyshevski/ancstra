// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransferOwnershipDialog } from '@/components/members/transfer-ownership-dialog';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
import { toast } from 'sonner';

const member = {
  id: 'm-2',
  userId: 'u-admin',
  role: 'admin' as const,
  joinedAt: '2026-01-01',
  name: 'Admin Person',
  email: 'admin@test',
  lastSeenAt: null,
};

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  member,
  familyId: 'fam-1',
  familyName: 'My Family',
  onTransferred: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe('<TransferOwnershipDialog>', () => {
  it('confirm button is disabled until family name typed exactly', () => {
    render(<TransferOwnershipDialog {...baseProps} />);
    const button = screen.getByRole('button', { name: /transfer ownership/i });
    expect(button).toHaveProperty('disabled', true);

    const input = screen.getByLabelText(/type the family name/i);
    fireEvent.change(input, { target: { value: 'wrong' } });
    expect(button).toHaveProperty('disabled', true);

    fireEvent.change(input, { target: { value: 'My Family' } });
    expect(button).toHaveProperty('disabled', false);
  });

  it('whitespace-trimmed match enables button', () => {
    render(<TransferOwnershipDialog {...baseProps} />);
    const input = screen.getByLabelText(/type the family name/i);
    fireEvent.change(input, { target: { value: '  My Family  ' } });
    expect(screen.getByRole('button', { name: /transfer ownership/i })).toHaveProperty('disabled', false);
  });

  it('200: success toast + onTransferred + onOpenChange(false)', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
    render(<TransferOwnershipDialog {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/type the family name/i), {
      target: { value: 'My Family' },
    });
    fireEvent.click(screen.getByRole('button', { name: /transfer ownership/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/families/fam-1/members/u-admin/transfer-ownership',
        expect.objectContaining({ method: 'POST' })
      );
      expect(toast.success).toHaveBeenCalled();
      expect(baseProps.onTransferred).toHaveBeenCalled();
      expect(baseProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('409: concurrent-transfer toast; dialog stays open', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ code: 'CONCURRENT_TRANSFER', error: 'Concurrent transfer detected. Please retry.' }),
        { status: 409 }
      )
    );
    render(<TransferOwnershipDialog {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/type the family name/i), {
      target: { value: 'My Family' },
    });
    fireEvent.click(screen.getByRole('button', { name: /transfer ownership/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/concurrent transfer/i)
      );
      expect(baseProps.onOpenChange).not.toHaveBeenCalledWith(false);
      expect(baseProps.onTransferred).not.toHaveBeenCalled();
    });
  });

  it('other error: surfaces server message', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Target user must be an admin to receive ownership' }), { status: 400 })
    );
    render(<TransferOwnershipDialog {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/type the family name/i), {
      target: { value: 'My Family' },
    });
    fireEvent.click(screen.getByRole('button', { name: /transfer ownership/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/must be an admin/i)
      );
    });
  });
});
