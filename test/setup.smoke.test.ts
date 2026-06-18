import { describe, expect, it } from 'vitest';

describe('test harness', () => {
  it('exposes an in-memory chrome.storage.local', async () => {
    await chrome.storage.local.set({ foo: 'bar' });
    const result = await chrome.storage.local.get(['foo']);
    expect(result.foo).toBe('bar');
  });

  it('provides a DOM via happy-dom', () => {
    const el = document.createElement('div');
    el.textContent = 'hi';
    expect(el.textContent).toBe('hi');
  });
});
