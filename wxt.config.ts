import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  outDir: 'dist',
  imports: false,
  manifest: {
    name: 'Hover Translate',
    description:
      'ページ上の段落やリストを指して右クリックするだけで、その部分を日本語に翻訳します。DeepL API (Free / Pro) と Chrome 組込みの翻訳に対応。',
    homepage_url: 'https://github.com/shu-pf/deepl-chrome-extension',
    permissions: ['storage', 'activeTab', 'contextMenus'],
    host_permissions: [
      'https://api.deepl.com/*',
      'https://api-free.deepl.com/*',
    ],
    action: {
      default_title: 'Hover Translate の設定',
    },
    commands: {
      'toggle-hover-mode': {
        suggested_key: { default: 'Ctrl+Shift+L', mac: 'Command+Shift+L' },
        description: '翻訳モードを有効化/無効化',
      },
    },
  },
});
