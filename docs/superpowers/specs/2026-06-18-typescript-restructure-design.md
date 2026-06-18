# DeepL Chrome 拡張: TypeScript 化 + 構造化 設計

- 日付: 2026-06-18
- 種別: リファクタリング（振る舞い維持）

## 目的

現在 `background.js` / `content.js` / `popup.js` に直接書かれている拡張機能を、
TypeScript + 明確なディレクトリ構成へ作り替え、読みやすく保守しやすいアプリケーションにする。
**ユーザーから見た動作は一切変えない**（純粋な内部構造の作り替え）。

## スコープ

- 振る舞いは完全に維持する。新機能・挙動変更は行わない。
- 対象: ビルド構成の導入、TypeScript 化、モジュール分割、Lint/Format 整備。

### 維持すべき既存挙動（受け入れ基準）

**background（service worker）**

1. `translate` メッセージ受信 → DeepL API (`https://api.deepl.com/v2/translate`, `target_lang: JA`, `tag_handling: html`, `tag_handling_version: v2`) を呼び、結果を返す。APIキー未登録時はエラー応答。
2. `toggle-hover-mode` コマンド → アクティブタブへ `toggle-hover-mode` メッセージ送信。
3. コンテキストメニュー「表示中のページの翻訳を解消する」(`clear-translations`) → 該当 URL のストレージキー削除 + タブをリロード。
4. install / startup でコンテキストメニューを作成。

**content**

1. `toggle-hover-mode` メッセージ受信でホバーモード切替。
2. 読込時に保存済み翻訳を復元（DOMContentLoaded / load、500ms 遅延、一度だけ実行）。
3. ホバーモード: 要素ハイライト（青 outline）、ESC で解除、カーソル crosshair。
4. 右クリック翻訳: APIキー確認 → 10,000 文字超で confirm → 背景へ HTML 送信 → `innerHTML` 置換 → `data-deepl-translated` / `data-deepl-original` 付与 → ストレージ保存。
5. ストレージ保存: URL ごとのキー（`deepl_translations_<url>`）、セレクタをキーに保存。
6. セレクタ生成（id 優先、class エスケープ、`nth-of-type`）。
7. 復元: 各セレクタを `querySelector` し `innerHTML` 反映、失敗時は `textContent` フォールバック。

**popup**: APIキーの読込 / 保存 / ステータス表示（3秒で消える）。

## ビルド構成

**Vite + @crxjs/vite-plugin** を採用（MV3 拡張の事実上の標準）。

- `manifest.config.ts` で型付き manifest を定義（現 `manifest.json` の内容を移植: permissions, host_permissions, action popup, background service worker, content_scripts, commands）。
- `npm run dev` で開発中の自動リロード、`npm run build` で `dist/` 生成。
- パッケージマネージャは npm。`@types/chrome` を導入。

## ディレクトリ構成

```
src/
  manifest.config.ts        # @crxjs 用の型付き manifest 定義
  shared/
    messages.ts             # メッセージ契約の型 + 送受信ヘルパー
    storage.ts              # chrome.storage アクセス集約（APIキー / 翻訳データのキー形式・get/set/remove）
  background/
    index.ts                # service worker エントリ。各リスナーを配線するだけ
    deepl.ts                # DeepL API クライアント（translateText）
    context-menu.ts         # メニュー作成 + clear-translations 処理
  content/
    index.ts                # content エントリ。toggle受信・復元スケジューリングを配線
    hover-mode.ts           # 有効/無効・ハイライト・ESC・カーソル
    translator.ts           # 右クリック翻訳フロー（APIキー確認→送信→置換→保存）
    selector.ts             # generateSelector / escapeCSSClass（純粋関数）
    translation-store.ts    # ページ上の翻訳の保存・復元（DOM適用）
  popup/
    index.html              # 現 popup.html（style は当面そのまま内包）
    popup.ts                # APIキーフォーム
```

### 分割の原則

- 各ファイルは 1 つの役割を持つ。`index.ts`（エントリ）は**配線だけ**でロジックを持たない。
- ストレージのキー形式（`deepl_translations_<url>` / `deeplApiKey`）は content と background の両方で使うため `shared/storage.ts` に集約し、キー形式のズレを防ぐ。
- 純粋関数（`selector.ts`）と DOM 操作（`translation-store.ts`）を分離し、可読性とテスト容易性を高める。

## メッセージの型付け

文字列ベースの `chrome.runtime` メッセージを判別可能ユニオンで型付けする。

```typescript
// shared/messages.ts
export type Message =
  | { action: 'translate'; html: string }
  | { action: 'toggle-hover-mode' };

export type TranslateResponse =
  | { success: true; translatedText: string }
  | { success: false; error: string };
```

- `action` の打ち間違いはコンパイルエラーになる。
- `response.success` での分岐により `translatedText` / `error` の存在を型で保証。
- 薄い送受信ヘルパーを用意し、各所の `chrome.runtime` 直叩きを置き換える（挙動は同一）。

## 周辺ツール

- **Prettier**: コード整形の自動化。
- **ESLint**（TypeScript 向け）: 未使用変数や危険な型の使い方を検出。
- 自動テスト（Vitest 等）は今回は導入しない。

## 検証方法

自動テストを持たないため、以下で「作り替え前後で挙動が同じ」を担保する。

- **静的チェック**: `tsc --noEmit`（型エラーゼロ）+ `eslint` + `prettier --check` が通る。
- **ビルド**: `npm run build` で `dist/` が生成される。
- **手動動作確認**（`dist/` を「パッケージ化されていない拡張機能を読み込む」で読込）:
  1. `Cmd+Shift+L` でホバーモード ON → 要素ハイライト → 右クリックで翻訳・置換。
  2. ページ再読込で翻訳が復元される。
  3. コンテキストメニュー「翻訳を解消する」で翻訳が消えてリロードされる。
  4. ポップアップで APIキー保存・再表示。

## 非対象（YAGNI）

- 新機能（原文↔翻訳トグル、翻訳一覧 UI、言語切替など）。
- UI/通知の改善（alert → トースト等）。
- 翻訳復元セレクタの信頼性向上。
- 既存挙動に関係しないリファクタリング。
