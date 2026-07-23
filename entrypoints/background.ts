import type { CheckApiKeyResponse, ExtensionMessage, TranslateResponse } from '@/utils/messages';
import { translationsStorageKey } from '@/utils/messages';

interface DeepLTranslateResponse {
  translations: { text: string }[];
}

// DeepL API呼び出し関数
async function translateText(text: string, apiKey: string): Promise<string> {
  // Free版のAPIキーは末尾が ":fx" になる
  const endpoint = apiKey.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: [text],
      target_lang: 'JA',
      tag_handling: 'html',
      tag_handling_version: 'v2'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepL APIエラー: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as DeepLTranslateResponse;
  if (data.translations && data.translations.length > 0) {
    return data.translations[0].text;
  }
  throw new Error('翻訳結果が取得できませんでした');
}

export default defineBackground(() => {
  // メッセージハンドラー
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const request = message as ExtensionMessage;
    if (request.action === 'translate') {
      (async () => {
        try {
          // APIキーを取得
          const result = await browser.storage.local.get(['deeplApiKey']);
          if (!result.deeplApiKey) {
            sendResponse({ success: false, error: 'APIキーが登録されていません' } satisfies TranslateResponse);
            return;
          }

          // 翻訳実行
          const translatedText = await translateText(request.html, result.deeplApiKey as string);

          sendResponse({ success: true, translatedText } satisfies TranslateResponse);
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          } satisfies TranslateResponse);
        }
      })();

      return true; // 非同期レスポンスを許可
    }

    if (request.action === 'check-api-key') {
      (async () => {
        const result = await browser.storage.local.get(['deeplApiKey']);
        sendResponse({ hasApiKey: Boolean(result.deeplApiKey) } satisfies CheckApiKeyResponse);
      })();

      return true; // 非同期レスポンスを許可
    }
  });

  // ショートカットキーの検知
  browser.commands.onCommand.addListener((command) => {
    if (command === 'toggle-hover-mode') {
      // アクティブなタブにメッセージを送信
      browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id !== undefined) {
          browser.tabs.sendMessage(tabs[0].id, { action: 'toggle-hover-mode' } satisfies ExtensionMessage);
        }
      });
    }
  });

  // Context Menuの作成
  function createContextMenu() {
    browser.contextMenus.removeAll(() => {
      browser.contextMenus.create({
        id: 'clear-translations',
        title: '表示中のページの翻訳を解消する',
        contexts: ['page']
      });
    });
  }

  browser.runtime.onInstalled.addListener(() => {
    createContextMenu();
  });

  browser.runtime.onStartup.addListener(() => {
    createContextMenu();
  });

  // Context Menuのクリックイベント
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'clear-translations') {
      if (tab?.id !== undefined && tab.url) {
        const tabId = tab.id;
        const storageKey = translationsStorageKey(tab.url);

        browser.storage.local.remove([storageKey], () => {
          browser.tabs.reload(tabId);
        });
      }
    }
  });
});
