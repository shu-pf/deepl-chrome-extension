export {};

const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const saveButton = document.getElementById('saveButton') as HTMLButtonElement;
const clearTranslationsButton = document.getElementById('clearTranslationsButton') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

// 既存のAPIキーを読み込む
const result = await browser.storage.local.get(['deeplApiKey']);
if (result.deeplApiKey) {
  apiKeyInput.value = result.deeplApiKey as string;
}

// 保存ボタンのクリックイベント
saveButton.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showStatus('APIキーを入力してください', 'error');
    return;
  }

  try {
    await browser.storage.local.set({ deeplApiKey: apiKey });
    showStatus('APIキーを保存しました', 'success');
  } catch (error) {
    showStatus('保存に失敗しました: ' + (error instanceof Error ? error.message : String(error)), 'error');
  }
});

// 保存した翻訳をすべて削除するボタンのクリックイベント
clearTranslationsButton.addEventListener('click', async () => {
  try {
    const allItems = await browser.storage.local.get(null);
    const keysToRemove = Object.keys(allItems).filter((key) => key.startsWith('deepl_translations_'));

    if (keysToRemove.length === 0) {
      showStatus('保存された翻訳はありませんでした', 'success');
      return;
    }

    await browser.storage.local.remove(keysToRemove);
    showStatus(`保存した翻訳を削除しました（${keysToRemove.length}件）`, 'success');
  } catch (error) {
    showStatus('削除に失敗しました: ' + (error instanceof Error ? error.message : String(error)), 'error');
  }
});

function showStatus(message: string, type: 'success' | 'error') {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';

  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}
