import { getApiKey, setApiKey } from '../shared/storage';

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
  const saveButton = document.getElementById('saveButton') as HTMLButtonElement;
  const statusDiv = document.getElementById('status') as HTMLDivElement;

  function showStatus(message: string, type: 'success' | 'error'): void {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }

  const existingKey = await getApiKey();
  if (existingKey) {
    apiKeyInput.value = existingKey;
  }

  saveButton.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showStatus('APIキーを入力してください', 'error');
      return;
    }
    try {
      await setApiKey(apiKey);
      showStatus('APIキーを保存しました', 'success');
    } catch (error) {
      showStatus(
        '保存に失敗しました: ' +
          (error instanceof Error ? error.message : String(error)),
        'error',
      );
    }
  });
});
