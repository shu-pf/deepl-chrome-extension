import { afterEach, describe, expect, it, vi } from 'vitest';
import { translateText } from './deepl';

function mockFetch() {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ translations: [{ text: '訳' }] }), {
      status: 200,
    }),
  );
}

describe('translateText endpoint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the Free API host for keys ending with :fx', async () => {
    const fetchSpy = mockFetch();
    await translateText('<b>Hi</b>', 'abc:fx');
    expect(fetchSpy.mock.calls[0][0]).toBe(
      'https://api-free.deepl.com/v2/translate',
    );
  });

  it('uses the Pro API host for other keys', async () => {
    const fetchSpy = mockFetch();
    await translateText('<b>Hi</b>', 'abc');
    expect(fetchSpy.mock.calls[0][0]).toBe(
      'https://api.deepl.com/v2/translate',
    );
  });
});
