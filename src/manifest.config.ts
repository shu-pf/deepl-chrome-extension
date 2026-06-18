import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'DeepL Chrome Extension',
  version: '1.0.0',
  description: 'DeepL APIを使用してページの一部を翻訳する拡張機能',
  permissions: ['storage', 'activeTab', 'contextMenus', 'scripting'],
  host_permissions: ['https://api.deepl.com/*'],
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'DeepL翻訳設定',
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
