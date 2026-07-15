export {};

const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const saveButton = document.getElementById('saveButton') as HTMLButtonElement;
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

function showStatus(message: string, type: 'success' | 'error') {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';

  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}
