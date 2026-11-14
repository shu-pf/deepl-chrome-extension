import { clearTranslations } from '../shared/storage';

// タブで表示中のページの保存済み翻訳を消し、再読み込みして原文に戻す。
export async function clearTabTranslations(
  tab?: chrome.tabs.Tab,
): Promise<void> {
  if (!tab?.id || !tab.url) return;

  await clearTranslations(tab.url);
  await chrome.tabs.reload(tab.id);
}
