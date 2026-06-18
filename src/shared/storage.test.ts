import { describe, expect, it } from 'vitest';
import { getTranslationProvider, setTranslationProvider } from './storage';

describe('translation provider setting', () => {
  it('defaults to deepl when unset', async () => {
    expect(await getTranslationProvider()).toBe('deepl');
  });

  it('round-trips a stored provider', async () => {
    await setTranslationProvider('local');
    expect(await getTranslationProvider()).toBe('local');
  });

  it('falls back to deepl for an unknown stored value', async () => {
    await chrome.storage.local.set({ translationProvider: 'bogus' });
    expect(await getTranslationProvider()).toBe('deepl');
  });
});
