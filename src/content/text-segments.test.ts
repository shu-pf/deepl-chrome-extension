import { describe, expect, it } from 'vitest';
import { applyTranslatedSegments, collectTextNodes } from './text-segments';

function makeElement(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

describe('collectTextNodes', () => {
  it('collects non-empty text nodes in document order', () => {
    const el = makeElement('<p>Hello <b>brave</b> world</p>');
    const texts = collectTextNodes(el).map((n) => n.nodeValue);
    expect(texts).toEqual(['Hello ', 'brave', ' world']);
  });

  it('skips whitespace-only nodes and script/style content', () => {
    const el = makeElement(
      '<p>Hi</p>\n  <script>var x = 1;</script><style>.a{}</style>',
    );
    const texts = collectTextNodes(el).map((n) => n.nodeValue);
    expect(texts).toEqual(['Hi']);
  });
});

describe('applyTranslatedSegments', () => {
  it('rewrites node values in order, preserving tags', () => {
    const el = makeElement('<p>Hello <b>world</b></p>');
    const nodes = collectTextNodes(el);
    applyTranslatedSegments(nodes, ['こんにちは ', '世界']);
    expect(el.innerHTML).toBe('<p>こんにちは <b>世界</b></p>');
  });

  it('leaves extra nodes untouched when translated array is shorter', () => {
    const el = makeElement('<p>a<b>b</b></p>');
    const nodes = collectTextNodes(el);
    applyTranslatedSegments(nodes, ['X']);
    expect(el.innerHTML).toBe('<p>X<b>b</b></p>');
  });
});
