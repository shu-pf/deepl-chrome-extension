import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'DeepL Chrome Extension',
    description: 'DeepL APIを使用してページの一部を翻訳する拡張機能',
    permissions: ['storage', 'activeTab', 'contextMenus', 'scripting'],
    host_permissions: ['https://api.deepl.com/*'],
    commands: {
      'toggle-hover-mode': {
        suggested_key: {
          default: 'Ctrl+Shift+L',
          mac: 'Command+Shift+L',
        },
        description: '翻訳モードを有効化/無効化',
      },
    },
  },
});
