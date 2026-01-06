document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveButton = document.getElementById('saveButton');
  const statusDiv = document.getElementById('status');

  // 既存のAPIキーを読み込む
  const result = await chrome.storage.local.get(['deeplApiKey']);
  if (result.deeplApiKey) {
    apiKeyInput.value = result.deeplApiKey;
  }

  // 保存ボタンのクリックイベント
  saveButton.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus('APIキーを入力してください', 'error');
      return;
    }

    try {
      await chrome.storage.local.set({ deeplApiKey: apiKey });
      showStatus('APIキーを保存しました', 'success');
    } catch (error) {
      showStatus('保存に失敗しました: ' + error.message, 'error');
    }
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';

    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
});

