# ローカルLLM翻訳オプション Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DeepL API に加えて、Chrome 組込みの Translator API を使うオンデバイス翻訳プロバイダを追加し、設定で切替可能にする。

**Architecture:** プロバイダ抽象（`deepl` / `local`）を設定で切替。DeepL 経路は不変のまま温存。local 経路は content 側で要素のテキストノードを順序走査して segments 配列を作り、background の Translator API ラッパに送って翻訳、結果をノードへ書き戻して既存の永続化機構で保存する。

**Tech Stack:** TypeScript, Vite, @crxjs/vite-plugin, Chrome Translator API / Language Detector API（Chrome 138+）, テストは vitest + happy-dom。

## Global Constraints

- Chrome 138 以降が必要（Translator / Language Detector API）。
- 翻訳ターゲット言語は `ja` 固定。ソース言語は Language Detector API で自動検出。
- 既定プロバイダは `deepl`（既存ユーザーの挙動を変えない）。
- local 経路で API 利用不可の場合、**DeepL への暗黙フォールバックはしない**（明確なエラー表示）。
- TypeScript は strict・`noUnusedLocals`・`noUnusedParameters` 有効。未使用の変数/引数を残さない。
- 既存の DeepL 経路（`outerHTML` 送信、`tag_handling`）は変更しない。
- 外部サービス（DeepL 含む）・外部アプリ（Ollama / LM Studio）への新規依存を増やさない。

---

### Task 1: vitest + happy-dom テスト基盤

**Files:**
- Modify: `package.json`（devDependencies, scripts）
- Create: `vitest.config.ts`
- Create: `test/setup.ts`
- Create: `test/setup.smoke.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: グローバル `chrome.storage.local`（インメモリ）・`chrome.runtime.sendMessage`(vi.fn) のモック。各テスト前にストレージは自動クリアされる。

- [ ] **Step 1: 依存を追加**

Run:
```bash
npm install -D vitest happy-dom
```
Expected: `package.json` の devDependencies に `vitest` と `happy-dom` が追加される。

- [ ] **Step 2: test スクリプトを追加**

`package.json` の `scripts` に追加（既存行は保持）:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: vitest 設定を作成**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: chrome モックの setup を作成**

Create `test/setup.ts`:
```ts
import { beforeEach, vi } from 'vitest';

const store: Record<string, unknown> = {};

const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (keys: string[]) => {
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          if (key in store) result[key] = store[key];
        }
        return result;
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(store, items);
      }),
      remove: vi.fn(async (keys: string[]) => {
        for (const key of keys) delete store[key];
      }),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
  },
};

(globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  chromeMock.runtime.sendMessage.mockReset();
});
```

- [ ] **Step 5: スモークテストを作成**

Create `test/setup.smoke.test.ts`:
```ts
import { describe, expect, it } from 'vitest';

describe('test harness', () => {
  it('exposes an in-memory chrome.storage.local', async () => {
    await chrome.storage.local.set({ foo: 'bar' });
    const result = await chrome.storage.local.get(['foo']);
    expect(result.foo).toBe('bar');
  });

  it('provides a DOM via happy-dom', () => {
    const el = document.createElement('div');
    el.textContent = 'hi';
    expect(el.textContent).toBe('hi');
  });
});
```

> 注: `vitest.config.ts` の `include` は `src/**/*.test.ts` のみ対象だが、このスモークテストは `test/` 配下にある。Step 6 で確認するため、include に `test/**/*.test.ts` も足す。

- [ ] **Step 6: include を両ディレクトリ対応にする**

`vitest.config.ts` の include を更新:
```ts
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
```

- [ ] **Step 7: テスト実行**

Run: `npm test`
Expected: 2 件 PASS。

- [ ] **Step 8: コミット**

```bash
git add package.json package-lock.json vitest.config.ts test/setup.ts test/setup.smoke.test.ts
git commit -m "test: add vitest + happy-dom test harness with chrome mock"
```

---

### Task 2: storage にプロバイダ設定を追加

**Files:**
- Modify: `src/shared/storage.ts`
- Test: `src/shared/storage.test.ts`

**Interfaces:**
- Consumes: `chrome.storage.local`
- Produces:
  - `type TranslationProvider = 'deepl' | 'local'`
  - `getTranslationProvider(): Promise<TranslationProvider>` — 未設定・不正値は `'deepl'`
  - `setTranslationProvider(provider: TranslationProvider): Promise<void>`

- [ ] **Step 1: 失敗するテストを書く**

Create `src/shared/storage.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  getTranslationProvider,
  setTranslationProvider,
} from './storage';

describe('translation provider setting', () => {
  it('defaults to deepl when unset', async () => {
    expect(await getTranslationProvider()).toBe('deepl');
  });

  it('round-trips a stored provider', async () => {
    await setTranslationProvider('local');
    expect(await getTranslationProvider()).toBe('local');
  });

  it('falls back to deepl for an unknown stored value', async () => {
    await chrome.storage.local.set({ translationProvider: 'bogus' });
    expect(await getTranslationProvider()).toBe('deepl');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/shared/storage.test.ts`
Expected: FAIL（`getTranslationProvider` is not exported）。

- [ ] **Step 3: 実装を追加**

`src/shared/storage.ts` の先頭付近（`API_KEY_STORAGE_KEY` の下）に追加:
```ts
const TRANSLATION_PROVIDER_KEY = 'translationProvider';

export type TranslationProvider = 'deepl' | 'local';
```

同ファイル末尾に追加:
```ts
export async function getTranslationProvider(): Promise<TranslationProvider> {
  const result = await chrome.storage.local.get([TRANSLATION_PROVIDER_KEY]);
  return result[TRANSLATION_PROVIDER_KEY] === 'local' ? 'local' : 'deepl';
}

export async function setTranslationProvider(
  provider: TranslationProvider,
): Promise<void> {
  await chrome.storage.local.set({ [TRANSLATION_PROVIDER_KEY]: provider });
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/shared/storage.test.ts`
Expected: 3 件 PASS。

- [ ] **Step 5: コミット**

```bash
git add src/shared/storage.ts src/shared/storage.test.ts
git commit -m "feat: add translation provider setting to storage"
```

---

### Task 3: messages にローカル翻訳メッセージを追加

**Files:**
- Modify: `src/shared/messages.ts`
- Test: `src/shared/messages.test.ts`

**Interfaces:**
- Consumes: `chrome.runtime.sendMessage`
- Produces:
  - `Message` 型に `{ action: 'translate-local'; segments: string[] }` を追加
  - `type LocalTranslateResponse = { success: true; segments: string[] } | { success: false; error: string }`
  - `requestLocalTranslation(segments: string[]): Promise<LocalTranslateResponse>` — 応答が無ければ `Error('翻訳サービスからの応答がありません')`

- [ ] **Step 1: 失敗するテストを書く**

Create `src/shared/messages.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { requestLocalTranslation } from './messages';

describe('requestLocalTranslation', () => {
  it('sends a translate-local message and returns the response', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
      success: true,
      segments: ['訳1', '訳2'],
    });

    const response = await requestLocalTranslation(['s1', 's2']);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'translate-local',
      segments: ['s1', 's2'],
    });
    expect(response).toEqual({ success: true, segments: ['訳1', '訳2'] });
  });

  it('throws when there is no response', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined);
    await expect(requestLocalTranslation(['s1'])).rejects.toThrow(
      '翻訳サービスからの応答がありません',
    );
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/shared/messages.test.ts`
Expected: FAIL（`requestLocalTranslation` is not exported）。

- [ ] **Step 3: 実装を追加**

`src/shared/messages.ts` の `Message` 型を更新:
```ts
export type Message =
  | { action: 'translate'; html: string }
  | { action: 'translate-local'; segments: string[] }
  | { action: 'toggle-hover-mode' };
```

同ファイル末尾に追加:
```ts
export type LocalTranslateResponse =
  | { success: true; segments: string[] }
  | { success: false; error: string };

// content → background へローカル翻訳を依頼する。応答が無い場合は既存挙動と同じエラーを投げる。
export async function requestLocalTranslation(
  segments: string[],
): Promise<LocalTranslateResponse> {
  const message: Message = { action: 'translate-local', segments };
  const response = (await chrome.runtime.sendMessage(message)) as
    | LocalTranslateResponse
    | undefined;
  if (!response) {
    throw new Error('翻訳サービスからの応答がありません');
  }
  return response;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/shared/messages.test.ts`
Expected: 2 件 PASS。

- [ ] **Step 5: コミット**

```bash
git add src/shared/messages.ts src/shared/messages.test.ts
git commit -m "feat: add translate-local message and request helper"
```

---

### Task 4: Translator API ラッパ（local-translator）

**Files:**
- Create: `src/types/chrome-ai.d.ts`
- Create: `src/background/local-translator.ts`
- Test: `src/background/local-translator.test.ts`

**Interfaces:**
- Consumes: グローバル `Translator`, `LanguageDetector`（Chrome 組込み）
- Produces:
  - `translateSegments(segments: string[]): Promise<string[]>` — 空配列はそのまま `[]`。原言語を検出し、`Translator(source→'ja')` で各 segment を順次翻訳して同順の配列を返す。原言語が `ja` の場合は入力をそのまま返す。

- [ ] **Step 1: AI グローバルの型宣言を作成**

Create `src/types/chrome-ai.d.ts`:
```ts
// Chrome 組込み AI（Translator / Language Detector）の最小型宣言。
// 公式 d.ts が無いため、本拡張で使う範囲のみ宣言する。

type AICapabilityAvailability =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available';

interface LanguageDetectionResult {
  detectedLanguage: string;
  confidence: number;
}

interface LanguageDetectorInstance {
  detect(text: string): Promise<LanguageDetectionResult[]>;
}

declare const LanguageDetector: {
  availability(): Promise<AICapabilityAvailability>;
  create(): Promise<LanguageDetectorInstance>;
};

interface TranslatorInstance {
  translate(text: string): Promise<string>;
}

declare const Translator: {
  availability(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<AICapabilityAvailability>;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<TranslatorInstance>;
};
```

- [ ] **Step 2: 失敗するテストを書く**

Create `src/background/local-translator.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { translateSegments } from './local-translator';

type Mutable = Record<string, unknown>;
const g = globalThis as unknown as Mutable;

function installMocks(opts: {
  detected: string;
  detectorAvailability?: AICapabilityAvailability;
  translatorAvailability?: AICapabilityAvailability;
  translate?: (text: string) => string;
}) {
  const translateFn = vi.fn(async (text: string) =>
    (opts.translate ?? ((t: string) => `[ja]${t}`))(text),
  );
  const createTranslator = vi.fn(async () => ({ translate: translateFn }));
  g.LanguageDetector = {
    availability: vi.fn(async () => opts.detectorAvailability ?? 'available'),
    create: vi.fn(async () => ({
      detect: vi.fn(async () => [
        { detectedLanguage: opts.detected, confidence: 0.99 },
      ]),
    })),
  };
  g.Translator = {
    availability: vi.fn(async () => opts.translatorAvailability ?? 'available'),
    create: createTranslator,
  };
  return { translateFn, createTranslator };
}

afterEach(() => {
  delete g.LanguageDetector;
  delete g.Translator;
});

describe('translateSegments', () => {
  it('returns [] for empty input without touching the APIs', async () => {
    expect(await translateSegments([])).toEqual([]);
  });

  it('detects source language and translates each segment in order', async () => {
    const { translateFn } = installMocks({ detected: 'en' });
    const out = await translateSegments(['Hello', 'World']);
    expect(out).toEqual(['[ja]Hello', '[ja]World']);
    expect(translateFn).toHaveBeenCalledTimes(2);
  });

  it('returns input unchanged when source is already ja', async () => {
    installMocks({ detected: 'ja' });
    expect(await translateSegments(['こんにちは'])).toEqual(['こんにちは']);
  });

  it('throws when the translator is unavailable', async () => {
    installMocks({ detected: 'en', translatorAvailability: 'unavailable' });
    await expect(translateSegments(['Hello'])).rejects.toThrow(/利用できません/);
  });

  it('throws a Chrome-version hint when Translator is undefined', async () => {
    g.LanguageDetector = {
      availability: vi.fn(async () => 'available'),
      create: vi.fn(async () => ({
        detect: vi.fn(async () => [{ detectedLanguage: 'en', confidence: 1 }]),
      })),
    };
    // Translator 未定義のまま
    await expect(translateSegments(['Hello'])).rejects.toThrow(/Chrome 138/);
  });
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `npx vitest run src/background/local-translator.test.ts`
Expected: FAIL（`translateSegments` is not exported）。

- [ ] **Step 4: 実装を追加**

Create `src/background/local-translator.ts`:
```ts
const TARGET_LANGUAGE = 'ja';

// 言語ペアごとに Translator インスタンス（の生成 Promise）をキャッシュして再利用する。
const translatorCache = new Map<string, Promise<TranslatorInstance>>();

async function detectSourceLanguage(sample: string): Promise<string> {
  if (typeof LanguageDetector === 'undefined') {
    throw new Error(
      'この環境では言語検出がサポートされていません（Chrome 138 以降が必要です）',
    );
  }
  if ((await LanguageDetector.availability()) === 'unavailable') {
    throw new Error('言語検出モデルが利用できません');
  }
  const detector = await LanguageDetector.create();
  const results = await detector.detect(sample);
  const top = results[0];
  if (!top || !top.detectedLanguage || top.detectedLanguage === 'und') {
    throw new Error('原言語を判定できませんでした');
  }
  return top.detectedLanguage;
}

async function createTranslator(
  sourceLanguage: string,
): Promise<TranslatorInstance> {
  if (typeof Translator === 'undefined') {
    throw new Error(
      'この環境では Translator API がサポートされていません（Chrome 138 以降が必要です）',
    );
  }
  const availability = await Translator.availability({
    sourceLanguage,
    targetLanguage: TARGET_LANGUAGE,
  });
  if (availability === 'unavailable') {
    throw new Error(
      `言語ペア ${sourceLanguage}→${TARGET_LANGUAGE} は利用できません`,
    );
  }
  return Translator.create({
    sourceLanguage,
    targetLanguage: TARGET_LANGUAGE,
  });
}

function getTranslator(sourceLanguage: string): Promise<TranslatorInstance> {
  const cacheKey = `${sourceLanguage}:${TARGET_LANGUAGE}`;
  let cached = translatorCache.get(cacheKey);
  if (!cached) {
    cached = createTranslator(sourceLanguage).catch((error) => {
      translatorCache.delete(cacheKey);
      throw error;
    });
    translatorCache.set(cacheKey, cached);
  }
  return cached;
}

export async function translateSegments(
  segments: string[],
): Promise<string[]> {
  if (segments.length === 0) return [];

  const sample = segments.join(' ').slice(0, 1000);
  const sourceLanguage = await detectSourceLanguage(sample);
  if (sourceLanguage === TARGET_LANGUAGE) {
    return segments;
  }

  const translator = await getTranslator(sourceLanguage);
  const translated: string[] = [];
  for (const segment of segments) {
    translated.push(await translator.translate(segment));
  }
  return translated;
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npx vitest run src/background/local-translator.test.ts`
Expected: 5 件 PASS。

- [ ] **Step 6: コミット**

```bash
git add src/types/chrome-ai.d.ts src/background/local-translator.ts src/background/local-translator.test.ts
git commit -m "feat: add Translator API wrapper for on-device translation"
```

---

### Task 5: テキストノード走査ユーティリティ（text-segments）

**Files:**
- Create: `src/content/text-segments.ts`
- Test: `src/content/text-segments.test.ts`

**Interfaces:**
- Consumes: DOM（`document.createTreeWalker`, `NodeFilter`）
- Produces:
  - `collectTextNodes(element: HTMLElement): Text[]` — 空白のみ、`SCRIPT`/`STYLE`/`NOSCRIPT` 配下のノードは除外し、文書順で返す。
  - `applyTranslatedSegments(nodes: Text[], translated: string[]): void` — 同順で `nodeValue` を書き換える。translated が短い場合は余ったノードは据え置き。

- [ ] **Step 1: 失敗するテストを書く**

Create `src/content/text-segments.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { applyTranslatedSegments, collectTextNodes } from './text-segments';

function makeElement(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

describe('collectTextNodes', () => {
  it('collects non-empty text nodes in document order', () => {
    const el = makeElement('<p>Hello <b>brave</b> world</p>');
    const texts = collectTextNodes(el).map((n) => n.nodeValue);
    expect(texts).toEqual(['Hello ', 'brave', ' world']);
  });

  it('skips whitespace-only nodes and script/style content', () => {
    const el = makeElement(
      '<p>Hi</p>\n  <script>var x = 1;</script><style>.a{}</style>',
    );
    const texts = collectTextNodes(el).map((n) => n.nodeValue);
    expect(texts).toEqual(['Hi']);
  });
});

describe('applyTranslatedSegments', () => {
  it('rewrites node values in order, preserving tags', () => {
    const el = makeElement('<p>Hello <b>world</b></p>');
    const nodes = collectTextNodes(el);
    applyTranslatedSegments(nodes, ['こんにちは ', '世界']);
    expect(el.innerHTML).toBe('<p>こんにちは <b>世界</b></p>');
  });

  it('leaves extra nodes untouched when translated array is shorter', () => {
    const el = makeElement('<p>a<b>b</b></p>');
    const nodes = collectTextNodes(el);
    applyTranslatedSegments(nodes, ['X']);
    expect(el.innerHTML).toBe('<p>X<b>b</b></p>');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/content/text-segments.test.ts`
Expected: FAIL（モジュール未作成）。

- [ ] **Step 3: 実装を追加**

Create `src/content/text-segments.ts`:
```ts
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);

// 要素配下の翻訳対象テキストノードを文書順で収集する。
export function collectTextNodes(element: HTMLElement): Text[] {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node): number {
      if ((node.nodeValue ?? '').trim() === '') {
        return NodeFilter.FILTER_REJECT;
      }
      const parent = node.parentElement;
      if (parent && SKIP_TAGS.has(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

// 収集済みノードへ翻訳結果を同順で書き戻す。タグ構造は変更しない。
export function applyTranslatedSegments(
  nodes: Text[],
  translated: string[],
): void {
  nodes.forEach((node, index) => {
    if (index < translated.length) {
      node.nodeValue = translated[index];
    }
  });
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/content/text-segments.test.ts`
Expected: 4 件 PASS。

> happy-dom が `createTreeWalker` の `acceptNode` フィルタをサポートしない場合は、`NodeFilter.SHOW_TEXT` で全テキストノードを取得し、`acceptNode` と同条件で配列を `filter` する実装に切り替える（API シグネチャと戻り値は不変）。

- [ ] **Step 5: コミット**

```bash
git add src/content/text-segments.ts src/content/text-segments.test.ts
git commit -m "feat: add text-node collection and rewrite utilities"
```

---

### Task 6: content の翻訳経路をプロバイダで分岐

**Files:**
- Modify: `src/content/translator.ts`（全面置換）
- Test: `src/content/translator.test.ts`

**Interfaces:**
- Consumes: `getApiKey`, `getTranslationProvider`（storage）; `requestTranslation`, `requestLocalTranslation`（messages）; `collectTextNodes`, `applyTranslatedSegments`（text-segments）; `applyTranslation`, `saveTranslation`（translation-store）
- Produces: `translateElement(element: HTMLElement): Promise<boolean>`（シグネチャ不変）

- [ ] **Step 1: 失敗するテストを書く**

Create `src/content/translator.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { translateElement } from './translator';
import { setTranslationProvider } from '../shared/storage';
import * as messages from '../shared/messages';

beforeEach(() => {
  vi.restoreAllMocks();
  (globalThis as unknown as { alert: () => void }).alert = vi.fn();
  (globalThis as unknown as { confirm: () => boolean }).confirm = vi.fn(
    () => true,
  );
});

function mountElement(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

describe('translateElement (local provider)', () => {
  it('translates text nodes via requestLocalTranslation and preserves tags', async () => {
    await setTranslationProvider('local');
    vi.spyOn(messages, 'requestLocalTranslation').mockResolvedValue({
      success: true,
      segments: ['こんにちは ', '世界'],
    });

    const el = mountElement('<p>Hello <b>world</b></p>');
    const result = await translateElement(el);

    expect(result).toBe(true);
    expect(el.querySelector('p')!.innerHTML).toBe('こんにちは <b>世界</b>');
    expect(el.getAttribute('data-deepl-translated')).toBe('true');
  });

  it('restores original HTML and alerts on local failure', async () => {
    await setTranslationProvider('local');
    vi.spyOn(messages, 'requestLocalTranslation').mockResolvedValue({
      success: false,
      error: 'モデルが利用できません',
    });
    const alertSpy = globalThis.alert as unknown as ReturnType<typeof vi.fn>;

    const el = mountElement('<p>Hello</p>');
    await translateElement(el);

    expect(el.innerHTML).toBe('<p>Hello</p>');
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('モデルが利用できません'),
    );
  });
});

describe('translateElement (deepl provider)', () => {
  it('requires an API key and aborts when missing', async () => {
    await setTranslationProvider('deepl');
    const requestSpy = vi.spyOn(messages, 'requestTranslation');

    const el = mountElement('<p>Hello</p>');
    const result = await translateElement(el);

    expect(result).toBe(false);
    expect(requestSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/content/translator.test.ts`
Expected: FAIL（local 分岐が未実装）。

- [ ] **Step 3: translator.ts を全面置換**

Replace the entire contents of `src/content/translator.ts`:
```ts
import { requestLocalTranslation, requestTranslation } from '../shared/messages';
import { getApiKey, getTranslationProvider } from '../shared/storage';
import { applyTranslatedSegments, collectTextNodes } from './text-segments';
import { applyTranslation, saveTranslation } from './translation-store';

// 要素を翻訳して置き換える。DeepL でAPIキー未登録なら警告して false を返す
// （呼び出し側でホバーモードを無効化する）。それ以外は true を返す。
export async function translateElement(element: HTMLElement): Promise<boolean> {
  const provider = await getTranslationProvider();

  if (provider === 'deepl') {
    const apiKey = await getApiKey();
    if (!apiKey) {
      alert(
        'APIキーが登録されていません。拡張機能のポップアップからAPIキーを登録してください。',
      );
      return false;
    }
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

  const originalInnerHtml = element.innerHTML;

  try {
    document.body.style.cursor = 'wait';
    if (provider === 'local') {
      await translateLocal(element);
    } else {
      await translateDeepL(element);
    }
  } catch (error) {
    element.innerHTML = originalInnerHtml;
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

async function translateDeepL(element: HTMLElement): Promise<void> {
  const html = element.outerHTML;
  const response = await requestTranslation(html);
  if (!response.success) {
    throw new Error(response.error || '不明なエラー');
  }
  applyTranslation(element, response.translatedText, html);
  await saveTranslation(element, response.translatedText, html);
}

async function translateLocal(element: HTMLElement): Promise<void> {
  const originalHtml = element.outerHTML;
  const nodes = collectTextNodes(element);
  if (nodes.length === 0) {
    return;
  }
  const segments = nodes.map((node) => node.nodeValue ?? '');
  const response = await requestLocalTranslation(segments);
  if (!response.success) {
    throw new Error(response.error || '不明なエラー');
  }
  applyTranslatedSegments(nodes, response.segments);
  const translatedHtml = element.innerHTML;
  applyTranslation(element, translatedHtml, originalHtml);
  await saveTranslation(element, translatedHtml, originalHtml);
}
```

> 補足: local 経路は `applyTranslatedSegments` で既にノードを書き換えた後、`applyTranslation(element, element.innerHTML, ...)` を呼ぶ。これは innerHTML を同値で再設定しつつ `data-deepl-translated` / `data-deepl-original` 属性を付与し、復元機構（`restoreTranslations`）を DeepL と共通化するため。

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/content/translator.test.ts`
Expected: 3 件 PASS。

- [ ] **Step 5: 全テスト実行**

Run: `npm test`
Expected: 全件 PASS。

- [ ] **Step 6: コミット**

```bash
git add src/content/translator.ts src/content/translator.test.ts
git commit -m "feat: branch content translation by provider"
```

---

### Task 7: background に translate-local ハンドラを追加

**Files:**
- Modify: `src/background/index.ts`

**Interfaces:**
- Consumes: `translateSegments`（local-translator）, `Message`, `LocalTranslateResponse`, `TranslateResponse`（messages）
- Produces: `translate-local` メッセージへの応答（`LocalTranslateResponse`）

- [ ] **Step 1: index.ts を更新**

`src/background/index.ts` の import に追加:
```ts
import type {
  LocalTranslateResponse,
  Message,
  TranslateResponse,
} from '../shared/messages';
import { translateSegments } from './local-translator';
```
（既存の `import type { Message, TranslateResponse } from '../shared/messages';` は上記に置き換える。`getApiKey`・`translateText`・context-menu の import は維持。）

`chrome.runtime.onMessage.addListener` を以下に置き換える:
```ts
chrome.runtime.onMessage.addListener(
  (
    request: Message,
    _sender,
    sendResponse: (
      response: TranslateResponse | LocalTranslateResponse,
    ) => void,
  ) => {
    if (request.action === 'translate') {
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
    }

    if (request.action === 'translate-local') {
      (async () => {
        try {
          const segments = await translateSegments(request.segments);
          sendResponse({ success: true, segments });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true; // 非同期レスポンスを許可
    }

    return undefined;
  },
);
```

- [ ] **Step 2: 型チェック**

Run: `npm run typecheck`
Expected: エラーなし。

- [ ] **Step 3: ビルド**

Run: `npm run build`
Expected: 成功（`dist/` 生成）。

- [ ] **Step 4: コミット**

```bash
git add src/background/index.ts
git commit -m "feat: handle translate-local in background worker"
```

---

### Task 8: popup にプロバイダ選択 UI を追加

**Files:**
- Modify: `src/popup/index.html`
- Modify: `src/popup/popup.ts`

**Interfaces:**
- Consumes: `getApiKey`, `setApiKey`, `getTranslationProvider`, `setTranslationProvider`, `TranslationProvider`（storage）
- Produces: なし（UI）

- [ ] **Step 1: index.html にプロバイダ選択と local 情報を追加**

`<body>` 内、`<h1>` の直後・最初の `.form-group`（APIキー）の前に追加:
```html
    <div class="form-group">
      <label for="provider">翻訳エンジン</label>
      <select id="provider">
        <option value="deepl">DeepL API</option>
        <option value="local">ローカル翻訳（Chrome 組込み・無料）</option>
      </select>
    </div>
```

APIキーの `.form-group`（`<label for="apiKey">` を含む div）を `id="deeplSettings"` でラップするため、その div に `id` を付与:
```html
    <div class="form-group" id="deeplSettings">
```

`<button id="saveButton">保存</button>` の前に local 用情報ブロックを追加:
```html
    <div class="info" id="localInfo" style="display: none">
      <p>Chrome 138 以降が必要です。初回はモデルのダウンロードが発生します。</p>
      <p>翻訳は端末内で行われ、外部サーバーには送信されません（無料）。</p>
    </div>
```

`<select>` 用に既存 `<style>` 内へ追加（`input[type='text']` のルールの近く）:
```css
      select {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        box-sizing: border-box;
        background: white;
      }
```

- [ ] **Step 2: popup.ts を更新**

Replace the entire contents of `src/popup/popup.ts`:
```ts
import {
  getApiKey,
  getTranslationProvider,
  setApiKey,
  setTranslationProvider,
  type TranslationProvider,
} from '../shared/storage';

document.addEventListener('DOMContentLoaded', async () => {
  const providerSelect = document.getElementById(
    'provider',
  ) as HTMLSelectElement;
  const deeplSettings = document.getElementById(
    'deeplSettings',
  ) as HTMLDivElement;
  const localInfo = document.getElementById('localInfo') as HTMLDivElement;
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

  function applyProviderVisibility(provider: TranslationProvider): void {
    const isDeepl = provider === 'deepl';
    deeplSettings.style.display = isDeepl ? 'block' : 'none';
    localInfo.style.display = isDeepl ? 'none' : 'block';
  }

  const existingProvider = await getTranslationProvider();
  providerSelect.value = existingProvider;
  applyProviderVisibility(existingProvider);

  const existingKey = await getApiKey();
  if (existingKey) {
    apiKeyInput.value = existingKey;
  }

  providerSelect.addEventListener('change', () => {
    applyProviderVisibility(providerSelect.value as TranslationProvider);
  });

  saveButton.addEventListener('click', async () => {
    const provider = providerSelect.value as TranslationProvider;
    try {
      await setTranslationProvider(provider);

      if (provider === 'deepl') {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
          showStatus('APIキーを入力してください', 'error');
          return;
        }
        await setApiKey(apiKey);
      }

      showStatus('設定を保存しました', 'success');
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

- [ ] **Step 3: 型チェックとビルド**

Run: `npm run typecheck && npm run build`
Expected: エラーなし、ビルド成功。

- [ ] **Step 4: コミット**

```bash
git add src/popup/index.html src/popup/popup.ts
git commit -m "feat: add translation provider selector to popup"
```

---

### Task 9: 最終検証（lint / format / typecheck / test / build）

**Files:** なし（検証のみ）

- [ ] **Step 1: フォーマット適用**

Run: `npm run format`
Expected: 変更ファイルが prettier 整形される。

- [ ] **Step 2: 一括検証**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: 全て成功。

- [ ] **Step 3: 差分があればコミット**

```bash
git add -A
git commit -m "style: apply prettier formatting" || echo "no changes to commit"
```

- [ ] **Step 4: Chrome 138+ 手動スモークテスト**

`dist/` を `chrome://extensions`（デベロッパーモード）で読み込み、以下を確認:
1. popup で「ローカル翻訳」を選択して保存 → APIキー欄が隠れ、local 情報が表示される。
2. 英語のページで翻訳モード（Ctrl/Cmd+Shift+L）→ 要素ホバーで翻訳。初回はモデルDLの待ちが発生し得る。タグ構造が保持され、テキストが日本語化される。
3. リロード後も翻訳が復元される。
4. popper で「DeepL API」に戻し、APIキーを設定 → 従来どおり DeepL 翻訳が動く。
5. 古い Chrome もしくは未対応環境では、local 翻訳時に「Chrome 138 以降が必要」等のエラー alert が出て、元の DOM が保たれる（DeepL に勝手に切り替わらない）。

---

## Self-Review

**Spec coverage:**
- プロバイダ抽象 / 設定切替 → Task 2, 6, 8 ✅
- Translator API + Language Detector(自動検出) + ja 固定 → Task 4 ✅
- テキストノード走査でタグ保持 → Task 5, 6 ✅
- background 実行・(必要時 offscreen)→ Task 7（offscreen は spec の次善策として記載、現状は SW 実行）✅
- エラー処理（暗黙フォールバックなし / DL中 / 未対応）→ Task 4（例外）, 6（alert・DOM復元）, 8（情報表示）, 9（手動確認）✅
- 既定 deepl・既存挙動不変 → Task 2（既定値）, 6（DeepL 経路温存）✅
- vitest 導入・モック優先テスト → Task 1, 各 TDD タスク ✅
- スコープ外（言語選択UI等）→ 計画に含めない ✅

**Placeholder scan:** プレースホルダなし。各コード手順に実コードを記載。

**Type consistency:** `TranslationProvider`, `LocalTranslateResponse`, `requestLocalTranslation`, `translateSegments`, `collectTextNodes`, `applyTranslatedSegments`, `applyTranslation(element, translatedText, originalHtml)`, `saveTranslation(element, translatedText, originalHtml)` — タスク間で一致を確認済み。

> モデルDL進捗の通知（spec 4 章）は MVP では alert/カーソルの既存 UX に留め、`monitor` による進捗表示は将来拡張とする（YAGNI）。Translator API 未提供時のエラーで Chrome バージョンを案内するため、実用上の不利益は小さい。
