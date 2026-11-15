import type { Message, TranslateResponse } from '../shared/messages';
import { getApiKey } from '../shared/storage';
import { translateText } from './deepl';
import { clearTabTranslations } from './clear-translations';
import { createContextMenu, handleContextMenuClick } from './context-menu';
import { toggleHoverModeInTab } from './hover-mode-toggle';

export function registerBackground(): void {
  // translate メッセージ → DeepL 呼び出し
  chrome.runtime.onMessage.addListener(
    (
      request: Message,
      _sender,
      sendResponse: (response: TranslateResponse) => void,
    ) => {
      if (request.action !== 'translate') return;

      (async () => {
        try {
          const apiKey = await getApiKey();
          if (!apiKey) {
            sendResponse({
              success: false,
              error: 'APIキーが登録されていません',
            });
            return;
          }
          const translatedText = await translateText(request.html, apiKey);
          sendResponse({ success: true, translatedText });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();

      return true; // 非同期レスポンスを許可
    },
  );

  // ショートカット
  chrome.commands.onCommand.addListener((command, tab) => {
    if (command === 'toggle-hover-mode') {
      const tabId = tab?.id;
      if (tabId !== undefined) {
        void toggleHoverModeInTab(tabId);
      }
    } else if (command === 'clear-translations') {
      void clearTabTranslations(tab);
    }
  });

  // コンテキストメニュー
  chrome.runtime.onInstalled.addListener(createContextMenu);
  chrome.runtime.onStartup.addListener(createContextMenu);
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    void handleContextMenuClick(info, tab);
  });
}
