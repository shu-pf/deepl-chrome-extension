import type { ExtensionMessage, PageTranslations, TranslateResponse } from '@/utils/messages';
import { translationsStorageKey } from '@/utils/messages';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    let hoverModeEnabled = false;
    let hoveredElement: HTMLElement | null = null;

    // メッセージの検知（backgroundからのショートカットキー検知）
    browser.runtime.onMessage.addListener((message) => {
      const request = message as ExtensionMessage;
      if (request.action === 'toggle-hover-mode') {
        toggleHoverMode();
      }
    });

    // ページ読み込み時に保存された翻訳を適用（一度だけ実行）
    let restoreTranslationsScheduled = false;

    function scheduleRestoreTranslations() {
      if (restoreTranslationsScheduled) {
        return;
      }
      restoreTranslationsScheduled = true;

      // より長い遅延を入れて、Reactの完全なレンダリング後に実行
      setTimeout(() => {
        restoreTranslations();
      }, 500);
    }

    // DOMContentLoadedで実行
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', scheduleRestoreTranslations);
    } else {
      scheduleRestoreTranslations();
    }

    // loadイベントでも実行（SPAの場合、ページ遷移時に再実行される可能性があるため）
    window.addEventListener('load', scheduleRestoreTranslations);

    // ホバーモードの切り替え
    function toggleHoverMode() {
      hoverModeEnabled = !hoverModeEnabled;

      if (hoverModeEnabled) {
        enableHoverMode();
      } else {
        disableHoverMode();
      }
    }

    // ESCキーでホバーモードを解除
    function handleEscKey(e: KeyboardEvent) {
      if (!hoverModeEnabled) return;

      if (e.key === 'Escape') {
        hoverModeEnabled = false;
        disableHoverMode();
      }
    }

    // ホバーモードを有効化
    function enableHoverMode() {
      document.addEventListener('mouseover', handleMouseOver, true);
      document.addEventListener('mouseout', handleMouseOut, true);
      document.addEventListener('contextmenu', handleRightClick, true);
      document.addEventListener('keydown', handleEscKey, true);
      document.body.style.cursor = 'crosshair';
    }

    // ホバーモードを無効化
    function disableHoverMode() {
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      document.removeEventListener('contextmenu', handleRightClick, true);
      document.removeEventListener('keydown', handleEscKey, true);
      document.body.style.cursor = '';

      if (hoveredElement) {
        hoveredElement.style.outline = '';
        hoveredElement = null;
      }
    }

    // マウスオーバー時の処理
    function handleMouseOver(e: MouseEvent) {
      if (!hoverModeEnabled) return;

      const element = e.target;
      if (!(element instanceof HTMLElement)) return;
      if (element === document.body || element === document.documentElement) return;

      hoveredElement = element;
      element.style.outline = '2px solid #0066cc';
      element.style.outlineOffset = '2px';
    }

    // マウスアウト時の処理
    function handleMouseOut(e: MouseEvent) {
      if (!hoverModeEnabled) return;

      const element = e.target;
      if (element instanceof HTMLElement && element === hoveredElement) {
        element.style.outline = '';
      }
    }

    // 右クリック時の処理
    async function handleRightClick(e: MouseEvent) {
      if (!hoverModeEnabled) return;

      e.preventDefault();
      e.stopPropagation();

      const element = e.target;
      if (!(element instanceof HTMLElement)) return;

      // APIキーの確認
      const result = await browser.storage.local.get(['deeplApiKey']);
      if (!result.deeplApiKey) {
        alert('APIキーが登録されていません。拡張機能のポップアップからAPIキーを登録してください。');
        disableHoverMode();
        return;
      }

      // 要素のテキスト内容の文字数をカウント
      const textContent = element.textContent || '';
      const textLength = textContent.length;

      // 10,000文字を超える場合は警告
      if (textLength > 10000) {
        const confirmed = confirm(
          `翻訳対象の文字数が${textLength.toLocaleString()}文字です。\n` +
          `10,000文字を超えていますが、翻訳を続行しますか？`
        );

        if (!confirmed) {
          return;
        }
      }

      // 翻訳実行前にoutlineを解除
      element.style.outline = '';
      element.style.outlineOffset = '';

      // 要素のHTMLを取得
      const html = element.outerHTML;

      // 翻訳実行
      const originalHTML = element.innerHTML;

      try {
        // カーソルをローディング表示に変更
        document.body.style.cursor = 'wait';

        const response = (await browser.runtime.sendMessage({
          action: 'translate',
          html: html
        } satisfies ExtensionMessage)) as TranslateResponse | undefined;

        if (!response) {
          throw new Error('翻訳サービスからの応答がありません');
        }

        if (response.success) {
          // 翻訳結果で置き換え
          element.innerHTML = response.translatedText;
          element.setAttribute('data-deepl-translated', 'true');
          element.setAttribute('data-deepl-original', html);

          // ストレージに保存
          await saveTranslation(element, response.translatedText, html);
        } else {
          element.innerHTML = originalHTML;
          alert('翻訳に失敗しました: ' + (response.error || '不明なエラー'));
        }
      } catch (error) {
        element.innerHTML = originalHTML;
        alert('翻訳に失敗しました: ' + (error instanceof Error ? error.message : String(error)));
      } finally {
        // カーソルを元に戻す
        document.body.style.cursor = '';
      }
    }

    // 翻訳結果をストレージに保存
    async function saveTranslation(element: HTMLElement, translatedText: string, originalHtml: string) {
      const storageKey = translationsStorageKey(window.location.href);

      // 要素のセレクタを生成
      const selector = generateSelector(element);

      // 既存の翻訳データを取得
      const result = await browser.storage.local.get([storageKey]);
      const translations = (result[storageKey] as PageTranslations | undefined) || {};

      // 翻訳データを追加
      translations[selector] = {
        translatedText: translatedText,
        originalHtml: originalHtml,
        timestamp: Date.now()
      };

      // ストレージに保存
      await browser.storage.local.set({ [storageKey]: translations });
    }

    // CSSクラス名をエスケープ（特殊文字を含むクラス名を有効なセレクタに変換）
    function escapeCSSClass(className: string): string {
      // CSSセレクタで特殊文字をエスケープ
      // コロン(:)、角括弧([,])、その他の特殊文字をエスケープ
      return className.replace(/([!\"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
    }

    // 要素のセレクタを生成
    function generateSelector(element: HTMLElement): string {
      if (element.id) {
        return `#${element.id}`;
      }

      const path: string[] = [];
      let current: Element | null = element;
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let selector = current.nodeName.toLowerCase();

        if (current.className && typeof current.className === 'string') {
          const classes = current.className.trim().split(/\s+/).filter(c => c);
          if (classes.length > 0) {
            const escapedClasses = classes.map(escapeCSSClass);
            selector += '.' + escapedClasses.join('.');
          }
        }

        // 同じタグ名の兄弟要素のインデックスを追加
        let sibling: Element = current;
        let index = 1;
        while (sibling.previousElementSibling) {
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

    // 保存された翻訳を復元
    async function restoreTranslations() {
      const storageKey = translationsStorageKey(window.location.href);

      const result = await browser.storage.local.get([storageKey]);
      if (!result[storageKey]) {
        return;
      }

      const translations = result[storageKey] as PageTranslations;

      for (const [selector, data] of Object.entries(translations)) {
        try {
          const element = document.querySelector(selector);
          if (element && !element.hasAttribute('data-deepl-translated')) {
            try {
              // innerHTMLを使用して翻訳を反映
              element.innerHTML = data.translatedText;
            } catch {
              // innerHTMLでエラーが発生した場合（React管理下など）、textContentにフォールバック
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = data.translatedText;
              element.textContent = tempDiv.textContent || '';
            }

            element.setAttribute('data-deepl-translated', 'true');
            element.setAttribute('data-deepl-original', data.originalHtml);
          }
        } catch (error) {
          console.warn('翻訳の復元に失敗:', selector, error);
        }
      }
    }
  },
});
