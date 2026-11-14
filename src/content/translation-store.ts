import { getTranslations, saveTranslationEntry } from '../shared/storage';
import { generateSelector } from './selector';

// 翻訳結果を要素へ適用する。innerHTML が失敗（React 管理下など）の場合は textContent にフォールバック。
export function applyTranslation(
  element: Element,
  translatedText: string,
  originalHtml: string,
): void {
  try {
    element.innerHTML = translatedText;
  } catch {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = translatedText;
    element.textContent = tempDiv.textContent || '';
  }
  element.setAttribute('data-deepl-translated', 'true');
  element.setAttribute('data-deepl-original', originalHtml);
}

export async function saveTranslation(
  element: Element,
  translatedText: string,
  originalHtml: string,
): Promise<void> {
  const selector = generateSelector(element);
  await saveTranslationEntry(window.location.href, selector, {
    translatedText,
    originalHtml,
    timestamp: Date.now(),
  });
}

// 以前の DeepL 経路は要素の outerHTML ごと翻訳して保存していた。その保存分を
// そのまま innerHTML に入れると要素が入れ子になるため、外側のタグを外して中身だけ返す。
// 元の要素自体が同じタグの子を 1 つだけ持つ場合は区別できないので、そのまま返す。
function unwrapLegacyOuterHtml(
  translated: string,
  originalHtml: string,
): string {
  const originalRoot = singleElementRoot(originalHtml);
  const translatedRoot = singleElementRoot(translated);
  if (!originalRoot || !translatedRoot) return translated;
  if (translatedRoot.tagName !== originalRoot.tagName) return translated;
  const originalChild = singleElementRoot(originalRoot.innerHTML);
  if (originalChild && originalChild.tagName === originalRoot.tagName) {
    return translated;
  }
  return translatedRoot.innerHTML;
}

function singleElementRoot(html: string): Element | null {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  const nodes = Array.from(template.content.childNodes).filter(
    (n) => n.nodeType !== Node.TEXT_NODE || (n.nodeValue ?? '').trim() !== '',
  );
  return nodes.length === 1 && nodes[0].nodeType === Node.ELEMENT_NODE
    ? (nodes[0] as Element)
    : null;
}

export async function restoreTranslations(): Promise<void> {
  const translations = await getTranslations(window.location.href);

  for (const [selector, data] of Object.entries(translations)) {
    try {
      const element = document.querySelector(selector);
      if (element && !element.hasAttribute('data-deepl-translated')) {
        applyTranslation(
          element,
          unwrapLegacyOuterHtml(data.translatedText, data.originalHtml),
          data.originalHtml,
        );
      }
    } catch (error) {
      console.warn('翻訳の復元に失敗:', selector, error);
    }
  }
}

let restoreTranslationsScheduled = false;

// Reactの完全レンダリング後に実行するため、500msの遅延で一度だけ復元を予約する。
export function scheduleRestoreTranslations(): void {
  if (restoreTranslationsScheduled) return;
  restoreTranslationsScheduled = true;
  setTimeout(() => {
    void restoreTranslations();
  }, 500);
}
