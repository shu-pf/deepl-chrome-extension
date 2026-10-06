# DeepL拡張 TypeScript化・構造化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存の DeepL Chrome 拡張（`background.js`/`content.js`/`popup.js`）を、振る舞いを一切変えずに TypeScript + Vite + @crxjs + モジュール分割の構成へ作り替える。

**Architecture:** Vite + @crxjs/vite-plugin で MV3 をビルド。共通レイヤ（型付きメッセージ契約・ストレージアクセス）を `src/shared/` に集約し、`background`/`content`/`popup` がそれを利用する。各エントリ `index.ts` は配線のみを担う。

**Tech Stack:** TypeScript, Vite 5, @crxjs/vite-plugin, ESLint (typescript-eslint), Prettier, `@types/chrome`。

## Global Constraints

- 振る舞いを変えない（純粋リファクタ）。新機能・UI/通知変更・挙動修正は禁止。既存の細かな挙動（例: 翻訳後に `document.body.style.cursor` が空になりホバーモード中でも crosshair が外れる点）も**そのまま再現**する。
- 自動テストは導入しない。各タスクの検証は `npm run typecheck`（`tsc --noEmit`）+ `npm run lint` を通すこと。ビルド検証が必要なタスクでは `npm run build` も実行する。
- DeepL API 呼び出しは `https://api.deepl.com/v2/translate`, `target_lang: 'JA'`, `tag_handling: 'html'`, `tag_handling_version: 'v2'`、`Authorization: DeepL-Auth-Key <key>` を維持。
- ストレージキー: APIキーは `deeplApiKey`、翻訳データは `deepl_translations_<url>`（`<url>` は `window.location.href` / `tab.url`）。形式を変えない。
- パッケージマネージャは npm。各コミットメッセージ末尾に `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` を付ける。

---

### Task 1: プロジェクトツール一式のスキャフォールド

**Files:**

- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `src/manifest.config.ts`, `eslint.config.js`, `.prettierrc`
- Modify: `.gitignore`（無ければ Create）
- Create（スタブ。後続タスクで中身を差し替え）: `src/background/index.ts`, `src/content/index.ts`, `src/popup/index.html`, `src/popup/popup.ts`

**Interfaces:**

- Consumes: 既存 `manifest.json`（移植元）。
- Produces: `npm run build` が成功し `dist/` を生成する状態。後続タスクが `src/` 配下にモジュールを追加していける土台。

- [ ] **Step 1: 依存をインストール**

Run:

```bash
npm install -D vite@^5 typescript @types/chrome @crxjs/vite-plugin@beta eslint @eslint/js typescript-eslint eslint-config-prettier prettier
```

Expected: `node_modules/` と `package-lock.json` が生成される。

- [ ] **Step 2: `package.json` のメタ情報とスクリプトを設定**

`package.json` を編集（`name`/`version` は既存 manifest に合わせる）:

```json
{
  "name": "deepl-chrome-extension",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

（`devDependencies` は Step 1 で追記済みのものを残す。）

- [ ] **Step 3: `tsconfig.json` を作成**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["chrome", "vite/client"],
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: `src/manifest.config.ts` を作成（既存 manifest.json を型付きで移植）**

```typescript
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
```

- [ ] **Step 5: `vite.config.ts` を作成**

```typescript
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest.config';

export default defineConfig({
  plugins: [crx({ manifest })],
});
```

- [ ] **Step 6: `eslint.config.js` と `.prettierrc` を作成**

`eslint.config.js`:

```javascript
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { chrome: 'readonly' } } },
  prettier,
);
```

`.prettierrc`:

```json
{ "singleQuote": true, "semi": true }
```

- [ ] **Step 7: `.gitignore` を更新**

`.gitignore` に以下を追記（無ければ作成）:

```
node_modules/
dist/
```

- [ ] **Step 8: スタブのエントリファイルを作成**

`src/background/index.ts`:

```typescript
// background service worker entry. 実装は後続タスクで配線する。
console.debug('[deepl] background worker loaded');
```

`src/content/index.ts`:

```typescript
// content script entry. 実装は後続タスクで配線する。
console.debug('[deepl] content script loaded');
```

`src/popup/popup.ts`:

```typescript
// popup entry. 実装は後続タスクで差し替える。
```

`src/popup/index.html`（既存 `popup.html` の `<style>` をそのまま移植し、`<script>` を `popup.ts` のモジュール参照に変更）:

```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DeepL API設定</title>
    <style>
      body {
        width: 400px;
        padding: 20px;
        font-family:
          -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu,
          Cantarell, sans-serif;
        margin: 0;
      }
      h1 {
        font-size: 18px;
        margin: 0 0 20px 0;
        color: #333;
      }
      .form-group {
        margin-bottom: 15px;
      }
      label {
        display: block;
        margin-bottom: 5px;
        font-size: 14px;
        color: #666;
        font-weight: 500;
      }
      input[type='text'],
      input[type='password'] {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        box-sizing: border-box;
      }
      input[type='text']:focus,
      input[type='password']:focus {
        outline: none;
        border-color: #0066cc;
      }
      button {
        background-color: #0066cc;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        width: 100%;
        font-weight: 500;
      }
      button:hover {
        background-color: #0052a3;
      }
      button:disabled {
        background-color: #ccc;
        cursor: not-allowed;
      }
      .status {
        margin-top: 10px;
        padding: 8px;
        border-radius: 4px;
        font-size: 12px;
        display: none;
      }
      .status.success {
        background-color: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
      }
      .status.error {
        background-color: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
      }
      .info {
        font-size: 12px;
        color: #666;
        margin-top: 10px;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <h1>DeepL API設定</h1>
    <div class="form-group">
      <label for="apiKey">APIキー（Pro版）</label>
      <input
        type="password"
        id="apiKey"
        placeholder="DeepL APIキーを入力してください"
      />
    </div>
    <button id="saveButton">保存</button>
    <div id="status" class="status"></div>
    <div class="info">
      <p>DeepL API Pro版のAPIキーが必要です。</p>
      <p>
        ショートカット: Ctrl+Shift+L (Mac: Command+Shift+L)
        で翻訳モードを有効化できます。
      </p>
    </div>
    <script type="module" src="./popup.ts"></script>
  </body>
</html>
```

- [ ] **Step 9: ビルドと静的チェックを実行**

Run:

```bash
npm run typecheck && npm run lint && npm run build
```

Expected: いずれも成功。`dist/` が生成され、`dist/manifest.json` に permissions/commands/action が含まれる。

- [ ] **Step 10: コミット**

```bash
git add -A
git commit -m "$(printf 'chore: scaffold Vite + @crxjs + TS tooling\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 2: 共通レイヤ（メッセージ契約とストレージ）

**Files:**

- Create: `src/shared/messages.ts`, `src/shared/storage.ts`

**Interfaces:**

- Consumes: なし（`chrome.*` API のみ）。
- Produces:
  - `messages.ts`: `type Message`, `type TranslateResponse`, `async function requestTranslation(html: string): Promise<TranslateResponse>`
  - `storage.ts`: `interface TranslationEntry { translatedText: string; originalHtml: string; timestamp: number }`, `type TranslationMap = Record<string, TranslationEntry>`, `async function getApiKey(): Promise<string | undefined>`, `async function setApiKey(key: string): Promise<void>`, `async function getTranslations(url: string): Promise<TranslationMap>`, `async function saveTranslationEntry(url: string, selector: string, entry: TranslationEntry): Promise<void>`, `async function clearTranslations(url: string): Promise<void>`

- [ ] **Step 1: `src/shared/messages.ts` を作成**

```typescript
export type Message =
  { action: 'translate'; html: string } | { action: 'toggle-hover-mode' };

export type TranslateResponse =
  { success: true; translatedText: string } | { success: false; error: string };

// content → background へ翻訳を依頼する。応答が無い場合は既存挙動と同じエラーを投げる。
export async function requestTranslation(
  html: string,
): Promise<TranslateResponse> {
  const message: Message = { action: 'translate', html };
  const response = (await chrome.runtime.sendMessage(message)) as
    TranslateResponse | undefined;
  if (!response) {
    throw new Error('翻訳サービスからの応答がありません');
  }
  return response;
}
```

- [ ] **Step 2: `src/shared/storage.ts` を作成**

```typescript
const API_KEY_STORAGE_KEY = 'deeplApiKey';

export interface TranslationEntry {
  translatedText: string;
  originalHtml: string;
  timestamp: number;
}

export type TranslationMap = Record<string, TranslationEntry>;

function translationStorageKey(url: string): string {
  return `deepl_translations_${url}`;
}

export async function getApiKey(): Promise<string | undefined> {
  const result = await chrome.storage.local.get([API_KEY_STORAGE_KEY]);
  return result[API_KEY_STORAGE_KEY] as string | undefined;
}

export async function setApiKey(key: string): Promise<void> {
  await chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: key });
}

export async function getTranslations(url: string): Promise<TranslationMap> {
  const key = translationStorageKey(url);
  const result = await chrome.storage.local.get([key]);
  return (result[key] as TranslationMap | undefined) ?? {};
}

export async function saveTranslationEntry(
  url: string,
  selector: string,
  entry: TranslationEntry,
): Promise<void> {
  const key = translationStorageKey(url);
  const translations = await getTranslations(url);
  translations[selector] = entry;
  await chrome.storage.local.set({ [key]: translations });
}

export async function clearTranslations(url: string): Promise<void> {
  await chrome.storage.local.remove([translationStorageKey(url)]);
}
```

- [ ] **Step 3: 静的チェック**

Run: `npm run typecheck && npm run lint`
Expected: 成功。

- [ ] **Step 4: コミット**

```bash
git add src/shared
git commit -m "$(printf 'feat: add typed messages and storage shared layer\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 3: background レイヤ

**Files:**

- Create: `src/background/deepl.ts`, `src/background/context-menu.ts`
- Modify: `src/background/index.ts`（スタブを差し替え）

**Interfaces:**

- Consumes: `shared/messages.ts`（`Message`, `TranslateResponse`）, `shared/storage.ts`（`getApiKey`, `clearTranslations`）
- Produces:
  - `deepl.ts`: `async function translateText(html: string, apiKey: string): Promise<string>`
  - `context-menu.ts`: `function createContextMenu(): void`, `async function handleContextMenuClick(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab): Promise<void>`
  - `index.ts`: 全リスナーの配線（戻り値なし）

- [ ] **Step 1: `src/background/deepl.ts` を作成（既存 background.js の translateText を移植）**

```typescript
export async function translateText(
  html: string,
  apiKey: string,
): Promise<string> {
  const response = await fetch('https://api.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [html],
      target_lang: 'JA',
      tag_handling: 'html',
      tag_handling_version: 'v2',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepL APIエラー: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as {
    translations?: Array<{ text: string }>;
  };
  if (data.translations && data.translations.length > 0) {
    return data.translations[0].text;
  }
  throw new Error('翻訳結果が取得できませんでした');
}
```

- [ ] **Step 2: `src/background/context-menu.ts` を作成（メニュー作成と clear-translations を移植）**

```typescript
import { clearTranslations } from '../shared/storage';

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
  if (!tab?.id || !tab.url) return;

  await clearTranslations(tab.url);
  await chrome.tabs.reload(tab.id);
}
```

- [ ] **Step 3: `src/background/index.ts` を実装（配線のみ）**

```typescript
import type { Message, TranslateResponse } from '../shared/messages';
import { getApiKey } from '../shared/storage';
import { translateText } from './deepl';
import { createContextMenu, handleContextMenuClick } from './context-menu';

// translate メッセージ → DeepL 呼び出し
chrome.runtime.onMessage.addListener(
  (
    request: Message,
    _sender,
    sendResponse: (response: TranslateResponse) => void,
  ) => {
    if (request.action !== 'translate') return;

    (async () => {
      try {
        const apiKey = await getApiKey();
        if (!apiKey) {
          sendResponse({
            success: false,
            error: 'APIキーが登録されていません',
          });
          return;
        }
        const translatedText = await translateText(request.html, apiKey);
        sendResponse({ success: true, translatedText });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();

    return true; // 非同期レスポンスを許可
  },
);

// ショートカット → アクティブタブへ toggle メッセージ
chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-hover-mode') return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (tabId !== undefined) {
      const message: Message = { action: 'toggle-hover-mode' };
      chrome.tabs.sendMessage(tabId, message);
    }
  });
});

// コンテキストメニュー
chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);
chrome.contextMenus.onClicked.addListener((info, tab) => {
  void handleContextMenuClick(info, tab);
});
```

- [ ] **Step 4: 静的チェックとビルド**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 成功。

- [ ] **Step 5: コミット**

```bash
git add src/background
git commit -m "$(printf 'feat: port background worker to TypeScript modules\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 4: content 永続化レイヤ（セレクタ生成・保存・復元）

**Files:**

- Create: `src/content/selector.ts`, `src/content/translation-store.ts`

**Interfaces:**

- Consumes: `shared/storage.ts`（`getTranslations`, `saveTranslationEntry`, `TranslationEntry`）
- Produces:
  - `selector.ts`: `function generateSelector(element: Element): string`
  - `translation-store.ts`: `async function saveTranslation(element: Element, translatedText: string, originalHtml: string): Promise<void>`, `function applyTranslation(element: Element, translatedText: string, originalHtml: string): void`, `async function restoreTranslations(): Promise<void>`, `function scheduleRestoreTranslations(): void`

- [ ] **Step 1: `src/content/selector.ts` を作成（generateSelector / escapeCSSClass を移植）**

```typescript
// CSSセレクタで特殊文字をエスケープ（コロン・角括弧などを含むクラス名を有効化）
function escapeCSSClass(className: string): string {
  return className.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

export function generateSelector(element: Element): string {
  if (element.id) {
    return `#${element.id}`;
  }

  const path: string[] = [];
  let current: Element | null = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let selector = current.nodeName.toLowerCase();

    if (current.className && typeof current.className === 'string') {
      const classes = current.className
        .trim()
        .split(/\s+/)
        .filter((c) => c);
      if (classes.length > 0) {
        selector += '.' + classes.map(escapeCSSClass).join('.');
      }
    }

    // 同じタグ名の兄弟要素のインデックス
    let sibling: Element | null = current;
    let index = 1;
    while (sibling?.previousElementSibling) {
      sibling = sibling.previousElementSibling;
      if (sibling.nodeName === current.nodeName) {
        index++;
      }
    }
    if (index > 1) {
      selector += `:nth-of-type(${index})`;
    }

    path.unshift(selector);

    if (current.id) {
      break;
    }
    current = current.parentElement;
  }

  return path.join(' > ');
}
```

- [ ] **Step 2: `src/content/translation-store.ts` を作成（保存・適用・復元・スケジューリングを移植）**

```typescript
import { getTranslations, saveTranslationEntry } from '../shared/storage';
import { generateSelector } from './selector';

// 翻訳結果を要素へ適用する。innerHTML が失敗（React 管理下など）の場合は textContent にフォールバック。
export function applyTranslation(
  element: Element,
  translatedText: string,
  originalHtml: string,
): void {
  try {
    element.innerHTML = translatedText;
  } catch {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = translatedText;
    element.textContent = tempDiv.textContent || '';
  }
  element.setAttribute('data-deepl-translated', 'true');
  element.setAttribute('data-deepl-original', originalHtml);
}

export async function saveTranslation(
  element: Element,
  translatedText: string,
  originalHtml: string,
): Promise<void> {
  const selector = generateSelector(element);
  await saveTranslationEntry(window.location.href, selector, {
    translatedText,
    originalHtml,
    timestamp: Date.now(),
  });
}

export async function restoreTranslations(): Promise<void> {
  const translations = await getTranslations(window.location.href);

  for (const [selector, data] of Object.entries(translations)) {
    try {
      const element = document.querySelector(selector);
      if (element && !element.hasAttribute('data-deepl-translated')) {
        applyTranslation(element, data.translatedText, data.originalHtml);
      }
    } catch (error) {
      console.warn('翻訳の復元に失敗:', selector, error);
    }
  }
}

let restoreTranslationsScheduled = false;

// Reactの完全レンダリング後に実行するため、500msの遅延で一度だけ復元を予約する。
export function scheduleRestoreTranslations(): void {
  if (restoreTranslationsScheduled) return;
  restoreTranslationsScheduled = true;
  setTimeout(() => {
    void restoreTranslations();
  }, 500);
}
```

> 注: 元の `restoreTranslations` は innerHTML の try/catch 内でさらに fallback を試みていた。本実装の `applyTranslation` は同じ「innerHTML→失敗時textContent」のフォールバックを共通化したもので、結果は等価。

- [ ] **Step 3: 静的チェック**

Run: `npm run typecheck && npm run lint`
Expected: 成功。

- [ ] **Step 4: コミット**

```bash
git add src/content/selector.ts src/content/translation-store.ts
git commit -m "$(printf 'feat: port translation persistence to content modules\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 5: content 操作レイヤと配線（ホバーモード・翻訳実行・エントリ）

**Files:**

- Create: `src/content/translator.ts`, `src/content/hover-mode.ts`
- Modify: `src/content/index.ts`（スタブを差し替え）

**Interfaces:**

- Consumes: `shared/messages.ts`（`Message`, `requestTranslation`）, `shared/storage.ts`（`getApiKey`）, `translation-store.ts`（`applyTranslation`, `saveTranslation`, `scheduleRestoreTranslations`）
- Produces:
  - `translator.ts`: `async function translateElement(element: HTMLElement): Promise<boolean>`（戻り値 `false` は「APIキー未登録なのでホバーモードを無効化すべき」を意味する）
  - `hover-mode.ts`: `function toggleHoverMode(): void`, `function disableHoverMode(): void`
  - `index.ts`: メッセージ受信と復元スケジューリングの配線

- [ ] **Step 1: `src/content/translator.ts` を作成（右クリック翻訳フローを移植）**

```typescript
import { requestTranslation } from '../shared/messages';
import { getApiKey } from '../shared/storage';
import { applyTranslation, saveTranslation } from './translation-store';

// 要素を翻訳して置き換える。APIキー未登録なら警告して false を返す（呼び出し側でホバーモードを無効化する）。
export async function translateElement(element: HTMLElement): Promise<boolean> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    alert(
      'APIキーが登録されていません。拡張機能のポップアップからAPIキーを登録してください。',
    );
    return false;
  }

  const textLength = (element.textContent || '').length;
  if (textLength > 10000) {
    const confirmed = confirm(
      `翻訳対象の文字数が${textLength.toLocaleString()}文字です。\n` +
        `10,000文字を超えていますが、翻訳を続行しますか？`,
    );
    if (!confirmed) {
      return true;
    }
  }

  // 翻訳実行前に outline を解除
  element.style.outline = '';
  element.style.outlineOffset = '';

  const html = element.outerHTML;
  const originalHTML = element.innerHTML;

  try {
    document.body.style.cursor = 'wait';
    const response = await requestTranslation(html);

    if (response.success) {
      applyTranslation(element, response.translatedText, html);
      await saveTranslation(element, response.translatedText, html);
    } else {
      element.innerHTML = originalHTML;
      alert('翻訳に失敗しました: ' + response.error);
    }
  } catch (error) {
    element.innerHTML = originalHTML;
    alert(
      '翻訳に失敗しました: ' +
        (error instanceof Error ? error.message : String(error)),
    );
  } finally {
    // 既存挙動を維持: ホバーモード中でもここでカーソルが既定に戻る
    document.body.style.cursor = '';
  }

  return true;
}
```

> 注: `applyTranslation` は `data-deepl-translated`/`data-deepl-original` 付与まで行うため、元コードの属性付与と等価。元コードは成功時 `element.innerHTML = response.translatedText` を直接代入していたが、`applyTranslation` 経由でも同じ結果（失敗時 textContent フォールバックが追加されるのみで、通常の HTML 要素では挙動同一）。

- [ ] **Step 2: `src/content/hover-mode.ts` を作成（ハイライト・ESC・カーソル・右クリック配線を移植）**

```typescript
import { translateElement } from './translator';

let hoverModeEnabled = false;
let hoveredElement: HTMLElement | null = null;

export function toggleHoverMode(): void {
  hoverModeEnabled = !hoverModeEnabled;
  if (hoverModeEnabled) {
    enableHoverMode();
  } else {
    disableHoverMode();
  }
}

function enableHoverMode(): void {
  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mouseout', handleMouseOut, true);
  document.addEventListener('contextmenu', handleRightClick, true);
  document.addEventListener('keydown', handleEscKey, true);
  document.body.style.cursor = 'crosshair';
}

export function disableHoverMode(): void {
  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('mouseout', handleMouseOut, true);
  document.removeEventListener('contextmenu', handleRightClick, true);
  document.removeEventListener('keydown', handleEscKey, true);
  document.body.style.cursor = '';

  if (hoveredElement) {
    hoveredElement.style.outline = '';
    hoveredElement = null;
  }
}

function handleEscKey(e: KeyboardEvent): void {
  if (!hoverModeEnabled) return;
  if (e.key === 'Escape') {
    hoverModeEnabled = false;
    disableHoverMode();
  }
}

function handleMouseOver(e: MouseEvent): void {
  if (!hoverModeEnabled) return;
  const element = e.target as HTMLElement;
  if (element === document.body || element === document.documentElement) return;

  hoveredElement = element;
  element.style.outline = '2px solid #0066cc';
  element.style.outlineOffset = '2px';
}

function handleMouseOut(e: MouseEvent): void {
  if (!hoverModeEnabled) return;
  const element = e.target as HTMLElement;
  if (element === hoveredElement) {
    element.style.outline = '';
  }
}

async function handleRightClick(e: MouseEvent): Promise<void> {
  if (!hoverModeEnabled) return;
  e.preventDefault();
  e.stopPropagation();

  const shouldContinue = await translateElement(e.target as HTMLElement);
  if (!shouldContinue) {
    disableHoverMode();
  }
}
```

> 注: 元コードでは右クリックハンドラ内で「APIキー確認 → 未登録なら `disableHoverMode()` して return」していた。本実装ではその判定を `translateElement` が `false` を返すことで表現し、`handleRightClick` が `disableHoverMode()` を呼ぶ。挙動は等価。

- [ ] **Step 3: `src/content/index.ts` を実装（配線のみ）**

```typescript
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
```

- [ ] **Step 4: 静的チェックとビルド**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 成功。

- [ ] **Step 5: コミット**

```bash
git add src/content
git commit -m "$(printf 'feat: port hover mode and translate flow to content modules\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 6: popup レイヤ

**Files:**

- Modify: `src/popup/popup.ts`（スタブを差し替え）

**Interfaces:**

- Consumes: `shared/storage.ts`（`getApiKey`, `setApiKey`）
- Produces: なし（DOM エントリ）

- [ ] **Step 1: `src/popup/popup.ts` を実装（既存 popup.js を移植）**

```typescript
import { getApiKey, setApiKey } from '../shared/storage';

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
  const saveButton = document.getElementById('saveButton') as HTMLButtonElement;
  const statusDiv = document.getElementById('status') as HTMLDivElement;

  function showStatus(message: string, type: 'success' | 'error'): void {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }

  const existingKey = await getApiKey();
  if (existingKey) {
    apiKeyInput.value = existingKey;
  }

  saveButton.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showStatus('APIキーを入力してください', 'error');
      return;
    }
    try {
      await setApiKey(apiKey);
      showStatus('APIキーを保存しました', 'success');
    } catch (error) {
      showStatus(
        '保存に失敗しました: ' +
          (error instanceof Error ? error.message : String(error)),
        'error',
      );
    }
  });
});
```

- [ ] **Step 2: 静的チェックとビルド**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 成功。

- [ ] **Step 3: コミット**

```bash
git add src/popup/popup.ts
git commit -m "$(printf 'feat: port popup to TypeScript\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 7: 旧ファイル削除と最終検証

**Files:**

- Delete: `background.js`, `content.js`, `popup.js`, `popup.html`, `manifest.json`

**Interfaces:**

- Consumes: なし
- Produces: ルートに旧 JS/HTML/manifest が残らない最終状態。

- [ ] **Step 1: 旧ファイルを削除**

Run:

```bash
git rm background.js content.js popup.js popup.html manifest.json
```

- [ ] **Step 2: フォーマットと全静的チェック・ビルド**

Run:

```bash
npm run format && npm run typecheck && npm run lint && npm run build
```

Expected: すべて成功。`dist/manifest.json` に permissions（storage, activeTab, contextMenus, scripting）・host_permissions・commands・action が含まれる。

- [ ] **Step 3: 手動動作確認（dist/ を読み込み）**

`chrome://extensions` →「パッケージ化されていない拡張機能を読み込む」で `dist/` を選択し、以下を確認:

1. ポップアップで APIキーを保存 → 再度開くと値が表示される。
2. 任意ページで `Cmd+Shift+L`（mac）→ 要素ホバーで青ハイライト → 右クリックで翻訳・置換される。
3. ページを再読込 → 翻訳が復元される。
4. ページ上で右クリック →「表示中のページの翻訳を解消する」→ 翻訳が消えてリロードされる。
5. APIキー未登録の状態で右クリック翻訳 → 警告が出てホバーモードが解除される。

Expected: 上記すべてが作り替え前と同じ挙動。

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "$(printf 'refactor: remove legacy JS entry files after TS migration\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## 完了の定義

- `npm run typecheck` / `npm run lint` / `npm run format:check` / `npm run build` がすべて通る。
- ルートに旧 `*.js` / `popup.html` / `manifest.json` が残っていない。
- 手動確認（Task 7 Step 3）の 5 項目が作り替え前と同一挙動。
