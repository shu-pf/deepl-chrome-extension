import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Hover Translator for DeepL API',
    description: 'DeepL API を使ってページ上の要素をホバー選択して翻訳する非公式の拡張機能',
    permissions: ['storage', 'activeTab', 'contextMenus'],
    host_permissions: ['https://api.deepl.com/*', 'https://api-free.deepl.com/*'],
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
