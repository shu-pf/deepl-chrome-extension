import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  _clearTranslatorCacheForTests,
  translateSegments,
} from './local-translator';

type Mutable = Record<string, unknown>;
const g = globalThis as unknown as Mutable;

function installMocks(opts: {
  detected: string;
  detectorAvailability?: AICapabilityAvailability;
  translatorAvailability?: AICapabilityAvailability;
  translate?: (text: string) => string;
}) {
  const translateFn = vi.fn(async (text: string) =>
    (opts.translate ?? ((t: string) => `[ja]${t}`))(text),
  );
  const createTranslator = vi.fn(async () => ({ translate: translateFn }));
  g.LanguageDetector = {
    availability: vi.fn(async () => opts.detectorAvailability ?? 'available'),
    create: vi.fn(async () => ({
      detect: vi.fn(async () => [
        { detectedLanguage: opts.detected, confidence: 0.99 },
      ]),
    })),
  };
  g.Translator = {
    availability: vi.fn(async () => opts.translatorAvailability ?? 'available'),
    create: createTranslator,
  };
  return { translateFn, createTranslator };
}

afterEach(() => {
  delete g.LanguageDetector;
  delete g.Translator;
  _clearTranslatorCacheForTests();
});

describe('translateSegments', () => {
  it('returns [] for empty input without touching the APIs', async () => {
    expect(await translateSegments([])).toEqual([]);
  });

  it('detects source language and translates each segment in order', async () => {
    const { translateFn } = installMocks({ detected: 'en' });
    const out = await translateSegments(['Hello', 'World']);
    expect(out).toEqual(['[ja]Hello', '[ja]World']);
    expect(translateFn).toHaveBeenCalledTimes(2);
  });

  it('returns input unchanged when source is already ja', async () => {
    installMocks({ detected: 'ja' });
    expect(await translateSegments(['こんにちは'])).toEqual(['こんにちは']);
  });

  it('throws when the translator is unavailable', async () => {
    installMocks({ detected: 'en', translatorAvailability: 'unavailable' });
    await expect(translateSegments(['Hello'])).rejects.toThrow(
      /利用できません/,
    );
  });

  it('throws a Chrome-version hint when Translator is undefined', async () => {
    g.LanguageDetector = {
      availability: vi.fn(async () => 'available'),
      create: vi.fn(async () => ({
        detect: vi.fn(async () => [{ detectedLanguage: 'en', confidence: 1 }]),
      })),
    };
    // Translator 未定義のまま
    await expect(translateSegments(['Hello'])).rejects.toThrow(/Chrome 138/);
  });
});
