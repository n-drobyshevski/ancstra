import { describe, it, expect } from 'vitest';
import { GotenbergClient } from '../src/pdf/gotenberg-client';

describe('GotenbergClient', () => {
  it('uses default URL when no argument provided', () => {
    const client = new GotenbergClient();
    // Access private field via any for testing
    expect((client as any).baseUrl).toBe('http://localhost:3100');
  });

  it('accepts a custom URL', () => {
    const client = new GotenbergClient('http://custom:9000');
    expect((client as any).baseUrl).toBe('http://custom:9000');
  });

  it('isAvailable returns false when no server is running', async () => {
    const client = new GotenbergClient('http://localhost:19999');
    const available = await client.isAvailable();
    expect(available).toBe(false);
  });
});
