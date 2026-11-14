import {
  getApiKey,
  getTranslationProvider,
  setApiKey,
  setTranslationProvider,
  type TranslationProvider,
} from '../../shared/storage';

document.addEventListener('DOMContentLoaded', async () => {
  const providerInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[name="provider"]'),
  );
  const deeplSettings = document.getElementById(
    'deeplSettings',
  ) as HTMLDivElement;
  const localInfo = document.getElementById('localInfo') as HTMLDivElement;
  const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
  const saveButton = document.getElementById('saveButton') as HTMLButtonElement;
  const statusDiv = document.getElementById('status') as HTMLDivElement;
  // ユーザーが chrome://extensions/shortcuts で変えた場合や、他と衝突して
  // 未割り当てになった場合もあるので、実際の割り当てを表示する。
  const commands = await chrome.commands.getAll();
  for (const kbd of document.querySelectorAll<HTMLElement>(
    'kbd[data-command]',
  )) {
    const command = commands.find((c) => c.name === kbd.dataset.command);
    kbd.textContent = command?.shortcut || '未設定';
  }

  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  function showStatus(message: string, type: 'success' | 'error'): void {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'flex';
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }

  function selectedProvider(): TranslationProvider {
    const checked = providerInputs.find((input) => input.checked);
    return checked?.value === 'local' ? 'local' : 'deepl';
  }

  function applyProvider(provider: TranslationProvider): void {
    for (const input of providerInputs) {
      input.checked = input.value === provider;
    }
    deeplSettings.hidden = provider !== 'deepl';
    localInfo.hidden = provider === 'deepl';
  }

  applyProvider(await getTranslationProvider());

  const existingKey = await getApiKey();
  if (existingKey) {
    apiKeyInput.value = existingKey;
  }

  for (const input of providerInputs) {
    input.addEventListener('change', () => applyProvider(selectedProvider()));
  }

  saveButton.addEventListener('click', async () => {
    const provider = selectedProvider();
    try {
      if (provider === 'deepl') {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
          showStatus('API キーを入力してください', 'error');
          apiKeyInput.focus();
          return;
        }
        await setApiKey(apiKey);
      }
      await setTranslationProvider(provider);

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
