import { describe, expect, it } from 'vitest';
import { splitEdgeDecorations } from './edge-decorations';

describe('splitEdgeDecorations', () => {
  it('keeps a trailing Sphinx headerlink out of the translated body', () => {
    const html =
      'Running “Batch” Migrations for SQLite and Other Databases' +
      '<a class="headerlink" href="#x" title="Link to this heading">#</a>';
    expect(splitEdgeDecorations(html)).toEqual({
      leading: '',
      body: 'Running “Batch” Migrations for SQLite and Other Databases',
      trailing:
        '<a class="headerlink" href="#x" title="Link to this heading">#</a>',
    });
  });

  it('keeps leading symbol-only or empty elements and surrounding whitespace', () => {
    const html = '<span>¶</span> <svg></svg> Title <b>bold</b>';
    expect(splitEdgeDecorations(html)).toEqual({
      leading: '<span>¶</span> <svg></svg>',
      body: ' Title <b>bold</b>',
      trailing: '',
    });
  });

  it('leaves symbol-only elements in the middle of the text alone', () => {
    const html = 'A <a href="#">#</a> B';
    expect(splitEdgeDecorations(html)).toEqual({
      leading: '',
      body: 'A <a href="#">#</a> B',
      trailing: '',
    });
  });

  it('does not strip elements that contain words or numbers', () => {
    const html = '<a href="#">Link</a> text <span>1</span>';
    expect(splitEdgeDecorations(html)).toEqual({
      leading: '',
      body: '<a href="#">Link</a> text <span>1</span>',
      trailing: '',
    });
  });

  it('returns an empty body when nothing is translatable', () => {
    const html = '<a class="headerlink" href="#x">#</a>';
    expect(splitEdgeDecorations(html)).toEqual({
      leading: '<a class="headerlink" href="#x">#</a>',
      body: '',
      trailing: '',
    });
  });
});
