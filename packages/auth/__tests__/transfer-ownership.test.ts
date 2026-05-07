import { describe, it, expect } from 'vitest';
import { ConcurrentTransferError } from '../src/types';

describe('ConcurrentTransferError', () => {
  it('is an Error with name=ConcurrentTransferError', () => {
    const err = new ConcurrentTransferError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ConcurrentTransferError);
    expect(err.name).toBe('ConcurrentTransferError');
    expect(err.message).toBe('test');
  });

  it('defaults message when none given', () => {
    const err = new ConcurrentTransferError();
    expect(err.message).toBe('Concurrent transfer detected. Please retry.');
  });
});
