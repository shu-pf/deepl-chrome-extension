// DeepL API呼び出し関数
async function translateText(text, apiKey) {
  const response = await fetch('https://api.deepl.com/v2/translate', {
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

  const data = await response.json();
  if (data.translations && data.translations.length > 0) {
    return data.translations[0].text;
  }
  throw new Error('翻訳結果が取得できませんでした');
}

// メッセージハンドラー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    (async () => {
      try {
        // APIキーを取得
        const result = await chrome.storage.local.get(['deeplApiKey']);
        if (!result.deeplApiKey) {
          sendResponse({ success: false, error: 'APIキーが登録されていません' });
          return;
        }

        // 翻訳実行
        const translatedText = await translateText(request.html, result.deeplApiKey);

        sendResponse({
          success: true,
          translatedText: translatedText
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();

    return true; // 非同期レスポンスを許可
  }
});

// ショートカットキーの検知
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-hover-mode') {
    // アクティブなタブにメッセージを送信
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle-hover-mode' });
      }
    });
  }
});

// Context Menuの作成
function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'clear-translations',
      title: '表示中のページの翻訳を解消する',
      contexts: ['page']
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenu();
});

// Context Menuのクリックイベント
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'clear-translations') {
    if (tab.id) {
      const url = tab.url;
      const storageKey = `deepl_translations_${url}`;

      chrome.storage.local.remove([storageKey], () => {
        chrome.tabs.reload(tab.id);
      });
    }
  }
});

