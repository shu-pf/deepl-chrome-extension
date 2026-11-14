import { describe, expect, it } from 'vitest';
import { restoreTranslations } from './translation-store';
import { saveTranslationEntry } from '../shared/storage';

describe('restoreTranslations', () => {
  it('unwraps legacy DeepL entries that stored the element outerHTML', async () => {
    document.body.innerHTML = '<ul id="list"><li>One</li></ul>';
    await saveTranslationEntry(window.location.href, '#list', {
      translatedText: '<ul id="list"><li>一</li></ul>',
      originalHtml: '<ul id="list"><li>One</li></ul>',
      timestamp: 0,
    });

    await restoreTranslations();

    const ul = document.getElementById('list')!;
    expect(ul.querySelector('ul')).toBeNull();
    expect(ul.innerHTML).toBe('<li>一</li>');
  });

  it('keeps a legitimate same-tag single child', async () => {
    document.body.innerHTML = '<div id="box"><div>Hi</div></div>';
    await saveTranslationEntry(window.location.href, '#box', {
      translatedText: '<div>やあ</div>',
      originalHtml: '<div id="box"><div>Hi</div></div>',
      timestamp: 0,
    });

    await restoreTranslations();

    expect(document.getElementById('box')!.innerHTML).toBe('<div>やあ</div>');
  });
});
