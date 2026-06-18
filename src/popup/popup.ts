import {
  getApiKey,
  getTranslationProvider,
  setApiKey,
  setTranslationProvider,
  type TranslationProvider,
} from '../shared/storage';

document.addEventListener('DOMContentLoaded', async () => {
  const providerSelect = document.getElementById(
    'provider',
  ) as HTMLSelectElement;
  const deeplSettings = document.getElementById(
    'deeplSettings',
  ) as HTMLDivElement;
  const localInfo = document.getElementById('localInfo') as HTMLDivElement;
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

  function applyProviderVisibility(provider: TranslationProvider): void {
    const isDeepl = provider === 'deepl';
    deeplSettings.style.display = isDeepl ? 'block' : 'none';
    localInfo.style.display = isDeepl ? 'none' : 'block';
  }

  const existingProvider = await getTranslationProvider();
  providerSelect.value = existingProvider;
  applyProviderVisibility(existingProvider);

  const existingKey = await getApiKey();
  if (existingKey) {
    apiKeyInput.value = existingKey;
  }

  providerSelect.addEventListener('change', () => {
    applyProviderVisibility(providerSelect.value as TranslationProvider);
  });

  saveButton.addEventListener('click', async () => {
    const provider = providerSelect.value as TranslationProvider;
    try {
      await setTranslationProvider(provider);

      if (provider === 'deepl') {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
          showStatus('APIキーを入力してください', 'error');
          return;
        }
        await setApiKey(apiKey);
      }

      showStatus('設定を保存しました', 'success');
    } catch (error) {
      showStatus(
        '保存に失敗しました: ' +
          (error instanceof Error ? error.message : String(error)),
        'error',
      );
    }
  });
});
