// CSSセレクタで特殊文字をエスケープ（コロン・角括弧などを含むクラス名を有効化）
function escapeCSSClass(className: string): string {
  return className.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

export function generateSelector(element: Element): string {
  if (element.id) {
    return `#${element.id}`;
  }

  const path: string[] = [];
  let current: Element | null = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let selector = current.nodeName.toLowerCase();

    if (current.className && typeof current.className === 'string') {
      const classes = current.className
        .trim()
        .split(/\s+/)
        .filter((c) => c);
      if (classes.length > 0) {
        selector += '.' + classes.map(escapeCSSClass).join('.');
      }
    }

    // 同じタグ名の兄弟要素のインデックス
    let sibling: Element | null = current;
    let index = 1;
    while (sibling?.previousElementSibling) {
      sibling = sibling.previousElementSibling;
      if (sibling.nodeName === current.nodeName) {
        index++;
      }
    }
    if (index > 1) {
      selector += `:nth-of-type(${index})`;
    }

    path.unshift(selector);

    if (current.id) {
      break;
    }
    current = current.parentElement;
  }

  return path.join(' > ');
}
