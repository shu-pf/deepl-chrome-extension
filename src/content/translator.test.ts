import { beforeEach, describe, expect, it, vi } from 'vitest';
import { translateElement } from './translator';
import { setTranslationProvider } from '../shared/storage';
import * as messages from '../shared/messages';
import * as localTranslator from './local-translator';

beforeEach(() => {
  vi.restoreAllMocks();
  (globalThis as unknown as { alert: () => void }).alert = vi.fn();
  (globalThis as unknown as { confirm: () => boolean }).confirm = vi.fn(
    () => true,
  );
});

function mountElement(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

describe('translateElement (local provider)', () => {
  it('translates text nodes via translateSegments and preserves tags', async () => {
    await setTranslationProvider('local');
    vi.spyOn(localTranslator, 'translateSegments').mockResolvedValue([
      'こんにちは ',
      '世界',
    ]);

    const el = mountElement('<p>Hello <b>world</b></p>');
    const result = await translateElement(el);

    expect(result).toBe(true);
    expect(el.querySelector('p')!.innerHTML).toBe('こんにちは <b>世界</b>');
    expect(el.getAttribute('data-deepl-translated')).toBe('true');
  });

  it('restores original HTML and alerts on local failure', async () => {
    await setTranslationProvider('local');
    vi.spyOn(localTranslator, 'translateSegments').mockRejectedValue(
      new Error('モデルが利用できません'),
    );
    const alertSpy = globalThis.alert as unknown as ReturnType<typeof vi.fn>;

    const el = mountElement('<p>Hello</p>');
    await translateElement(el);

    expect(el.innerHTML).toBe('<p>Hello</p>');
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('モデルが利用できません'),
    );
  });
});

describe('translateElement (deepl provider)', () => {
  it('requires an API key and aborts when missing', async () => {
    await setTranslationProvider('deepl');
    const requestSpy = vi.spyOn(messages, 'requestTranslation');

    const el = mountElement('<p>Hello</p>');
    const result = await translateElement(el);

    expect(result).toBe(false);
    expect(requestSpy).not.toHaveBeenCalled();
  });
});
