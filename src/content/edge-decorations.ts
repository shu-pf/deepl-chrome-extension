// 文字や数字を含まない要素（見出しの "#" / "¶" リンク、アイコンなど）を飾りとみなす。
// DeepL に HTML ごと渡すと、こうした要素が訳文の別の語に付け替わってしまう
// （例: Sphinx の headerlink が「データベース」を囲み、"#" が素の文字で残る）。
// そのため要素の先頭と末尾に並ぶ飾りは翻訳に送らず、訳文の前後へそのまま戻す。

export interface EdgeSplit {
  leading: string;
  body: string;
  trailing: string;
}

const MEANINGFUL = /[\p{L}\p{N}]/u;

function isDecoration(node: ChildNode): boolean {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.nodeValue ?? '').trim() === '';
  }
  if (node.nodeType === Node.COMMENT_NODE) {
    return true;
  }
  return !MEANINGFUL.test(node.textContent ?? '');
}

function serialize(nodes: ChildNode[]): string {
  const container = document.createElement('template');
  for (const node of nodes) {
    container.content.appendChild(node.cloneNode(true));
  }
  return container.innerHTML;
}

export function splitEdgeDecorations(html: string): EdgeSplit {
  const template = document.createElement('template');
  template.innerHTML = html;
  const nodes = Array.from(template.content.childNodes);

  let start = 0;
  while (start < nodes.length && isDecoration(nodes[start])) start++;
  let end = nodes.length;
  while (end > start && isDecoration(nodes[end - 1])) end--;

  // 飾りを切り出さない場合は元の文字列をそのまま返し、再シリアライズで書式を変えない。
  if (start === 0 && end === nodes.length) {
    return { leading: '', body: html, trailing: '' };
  }
  return {
    leading: serialize(nodes.slice(0, start)),
    body: serialize(nodes.slice(start, end)),
    trailing: serialize(nodes.slice(end)),
  };
}
