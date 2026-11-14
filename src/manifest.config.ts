import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Hover Translate',
  version: '1.0.0',
  description:
    'ページ上の段落やリストを指して右クリックするだけで、その部分を日本語に翻訳します。DeepL API (Free / Pro) と Chrome 組込みの翻訳に対応。',
  homepage_url: 'https://github.com/shu-pf/deepl-chrome-extension',
  icons: {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  permissions: ['storage', 'activeTab', 'contextMenus'],
  host_permissions: ['https://api.deepl.com/*', 'https://api-free.deepl.com/*'],
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Hover Translate の設定',
    default_icon: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  commands: {
    'toggle-hover-mode': {
      suggested_key: { default: 'Ctrl+Shift+L', mac: 'Command+Shift+L' },
      description: '翻訳モードを有効化/無効化',
    },
  },
});
