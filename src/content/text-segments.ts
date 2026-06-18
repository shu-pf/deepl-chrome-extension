const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);

// 要素配下の翻訳対象テキストノードを文書順で収集する。
export function collectTextNodes(element: HTMLElement): Text[] {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node): number {
      if ((node.nodeValue ?? '').trim() === '') {
        return NodeFilter.FILTER_REJECT;
      }
      const parent = node.parentElement;
      if (parent && SKIP_TAGS.has(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

// 収集済みノードへ翻訳結果を同順で書き戻す。タグ構造は変更しない。
export function applyTranslatedSegments(
  nodes: Text[],
  translated: string[],
): void {
  nodes.forEach((node, index) => {
    if (index < translated.length) {
      node.nodeValue = translated[index];
    }
  });
}
