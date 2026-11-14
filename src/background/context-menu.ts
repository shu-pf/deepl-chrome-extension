import { clearTabTranslations } from './clear-translations';

const CLEAR_TRANSLATIONS_ID = 'clear-translations';

export function createContextMenu(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CLEAR_TRANSLATIONS_ID,
      title: '表示中のページの翻訳を解消する',
      contexts: ['page'],
    });
  });
}

export async function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
): Promise<void> {
  if (info.menuItemId !== CLEAR_TRANSLATIONS_ID) return;
  await clearTabTranslations(tab);
}
