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

export async function restoreTranslations(): Promise<void> {
  const translations = await getTranslations(window.location.href);

  for (const [selector, data] of Object.entries(translations)) {
    try {
      const element = document.querySelector(selector);
      if (element && !element.hasAttribute('data-deepl-translated')) {
        applyTranslation(element, data.translatedText, data.originalHtml);
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
