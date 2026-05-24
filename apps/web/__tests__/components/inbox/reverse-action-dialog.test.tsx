// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ReverseActionDialog } from '@/components/inbox/reverse-action-dialog';

describe('ReverseActionDialog', () => {
  it('submit button disabled until non-empty reason typed', () => {
    const onConfirm = vi.fn();
    render(
      <ReverseActionDialog
        open
        title="Unmerge"
        description="Are you sure?"
        actionLabel="Unmerge"
        onOpenChange={() => {}}
        onConfirm={onConfirm}
      />,
    );
    const submit = screen.getByRole('button', { name: /Unmerge/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '  ' } });
    expect(submit.disabled).toBe(true);
    fireEvent.change(textarea, { target: { value: 'because' } });
    expect(submit.disabled).toBe(false);
  });

  it('calls onConfirm with trimmed reason', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <ReverseActionDialog
        open title="Restore" description="" actionLabel="Restore"
        onOpenChange={() => {}}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  reason text  ' } });
    fireEvent.click(screen.getByRole('button', { name: /Restore/i }));
    expect(onConfirm).toHaveBeenCalledWith('reason text');
  });

  it('autofocuses the textarea when opened', () => {
    render(
      <ReverseActionDialog
        open title="X" description="" actionLabel="X"
        onOpenChange={() => {}}
        onConfirm={vi.fn()}
      />,
    );
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });
});
