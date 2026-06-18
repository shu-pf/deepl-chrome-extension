import type { Message } from '../shared/messages';
import { toggleHoverMode } from './hover-mode';
import { scheduleRestoreTranslations } from './translation-store';

// background からの toggle メッセージ
chrome.runtime.onMessage.addListener((request: Message) => {
  if (request.action === 'toggle-hover-mode') {
    toggleHoverMode();
  }
});

// 読み込み時に保存済み翻訳を復元
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scheduleRestoreTranslations);
} else {
  scheduleRestoreTranslations();
}
window.addEventListener('load', scheduleRestoreTranslations);
