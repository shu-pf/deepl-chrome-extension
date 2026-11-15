import type { Message } from '../shared/messages';

// タブのホバーモードを切り替える。拡張の再読み込みや自動更新の前から開いていたタブには
// コンテンツスクリプトが居ないので、送信に失敗したらその場で注入して送り直す。
// chrome:// やウェブストアなどスクリプトを入れられないページでは何もしない。
export async function toggleHoverModeInTab(tabId: number): Promise<void> {
  const message: Message = { action: 'toggle-hover-mode' };
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return;
  } catch {
    // 受け手が居ない。下で注入する。
  }

  try {
    const files = chrome.runtime
      .getManifest()
      .content_scripts?.flatMap((script) => script.js ?? []);
    if (!files || files.length === 0) return;
    await chrome.scripting.executeScript({ target: { tabId }, files });
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.warn('ホバーモードを切り替えられないページです:', error);
  }
}
