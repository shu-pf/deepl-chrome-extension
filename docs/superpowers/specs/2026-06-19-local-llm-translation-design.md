# ローカルLLM翻訳オプション 設計書

作成日: 2026-06-19

## 背景と目的

現状の拡張機能は翻訳に DeepL API を使用している。これに加えて、**外部アプリ（Ollama / LM Studio 等）に依存せず拡張機能内で完結する**ローカル翻訳の選択肢を追加する。

主目的は **コスト削減**（DeepL API の従量課金/上限を避け、無料で使い続けられること）。副次的にプライバシー（端末内処理）とオフライン耐性の利点も得られる。

## 採用方針（ブレインストーミングで確定した決定事項）

- **翻訳エンジン**: Chrome 組込み AI（オンデバイス）。拡張機能側に巨大モデルを同梱せず、モデルのDL/管理は Chrome が担う。外部アプリ不要。
- **API**: **Translator API**（翻訳専用オンデバイスモデル）を使用。Prompt API(Gemini Nano) は品質・タグ保持の信頼性に劣るため採用しない。
- **HTMLタグ保持**: Translator API はプレーンテキスト翻訳のため、DOM のテキストノードを順序付きで走査して個別翻訳し、タグ構造は温存する。
- **ソース言語**: Chrome 組込みの **Language Detector API** で自動検出（DeepL の自動検出挙動に最も近い）。ターゲットは現状どおり日本語(`ja`)固定。
- **既定プロバイダ**: `deepl`（現状の挙動を維持）。

## 全体アーキテクチャ

プロバイダ抽象を導入し、`deepl`（既存）/ `local`（新規）を設定で切り替える。既存の DeepL 経路は変更せず温存し、ローカル経路を並走させる。

```
[content] translateElement
   ├─ provider = 'deepl' → outerHTML 送信 → [background] DeepL API（現状のまま）
   └─ provider = 'local' → テキストノード走査 → segments[] 送信
                              → [background] local-translator
                                  ├ LanguageDetector で原言語検出
                                  ├ Translator(src→ja) 生成/キャッシュ
                                  └ 各 segment 翻訳 → segments[] 返却
                              → [content] ノードへ書戻し → 永続化
```

Translator API / Language Detector API は **background（service worker）** で実行する。言語ペアごとの Translator インスタンスを background でキャッシュし、タブ/ページ横断で再利用する。

> 実装時の検証ポイント: Translator API / Language Detector API が extension service worker スコープで利用可能かを capability チェックで確認する。万一 service worker で未提供だった場合は、これらの API をホストする **offscreen document** を background から生成し、メッセージ経由でプロキシする方式に切り替える（次善策）。

## コンポーネント設計

### `src/background/local-translator.ts`（新規）

Translator API のラッパ。

- `detectSourceLanguage(sample: string): Promise<string>` — Language Detector API で原言語を検出。検出不能時はエラー。
- `translateSegments(segments: string[]): Promise<string[]>` — 原言語を検出し、`Translator(source → 'ja')` を生成（言語ペアごとにインスタンスをキャッシュ）、各 segment を翻訳して同順の配列で返す。
- `availability()` の状態（`available` / `downloadable` / `downloading` / `unavailable`）を判定し、`unavailable` の場合は明確なエラーを投げる。`downloadable`/`downloading` の場合は `create()` のダウンロード進捗モニタで状態を通知する。

### `src/content/text-segments.ts`（新規）

要素配下のテキストノードを扱うユーティリティ。

- `collectTextNodes(element): { node: Text; text: string }[]` — TreeWalker で順序付きにテキストノードを収集。空白のみのノードは除外。`<script>` / `<style>` 配下は除外。
- `applyTranslatedSegments(nodes, translated: string[]): void` — 同順の翻訳結果を各テキストノードへ代入。タグ構造は一切変更しない。

### `src/content/translator.ts`（変更）

`translateElement` を provider 設定で分岐させる。

- `provider === 'deepl'`: 既存経路（`outerHTML` を送信 → 翻訳済み HTML を受領 → `applyTranslation`）。**変更しない**。
- `provider === 'local'`:
  1. `collectTextNodes(element)` でテキストノードを収集。
  2. 収集テキスト配列を `{action:'translate-local', segments}` で background へ送信。
  3. 返却された翻訳配列を `applyTranslatedSegments` で書き戻す。
  4. 変異後の `element.innerHTML` を `saveTranslation` で保存（復元は既存機構を流用し、プロバイダ間で永続化方式を統一）。
- APIキー必須チェックは local では行わない（local は API キー不要）。

### `src/background/index.ts`（変更）

新メッセージ `translate-local` のハンドラを追加。`local-translator.translateSegments` を呼び、結果またはエラーを返す。既存の `translate`（DeepL）ハンドラはそのまま。

### `src/shared/storage.ts`（変更）

- `getTranslationProvider(): Promise<'deepl' | 'local'>` — 未設定時は `'deepl'`。
- `setTranslationProvider(provider): Promise<void>`。
- ストレージキー `translationProvider`。

### `src/shared/messages.ts`（変更）

- メッセージ型に `{ action: 'translate-local'; segments: string[] }` を追加。
- レスポンス型 `{ success: true; segments: string[] } | { success: false; error: string }`。
- `requestLocalTranslation(segments): Promise<...>` ヘルパを追加。

### `src/popup/`（変更）

- プロバイダ選択 UI（DeepL / ローカル翻訳）を追加。
- DeepL 選択時のみ APIキー入力欄を表示。
- ローカル選択時の注意書き: 「Chrome 138 以降が必要」「初回はモデルのダウンロードが発生」「無料・端末内処理」。
- 保存時にプロバイダ設定と（DeepL時の）APIキーを永続化。

## データフロー（local）

1. ホバー/コンテキストメニューで要素の翻訳をトリガ（既存）。
2. `translateElement` が provider 設定を読む。
3. local の場合、テキストノードを順序配列で抽出。
4. background へ `{action:'translate-local', segments}` を送信。
5. background が原言語を検出し、`Translator(source→ja)` で各 segment を翻訳、同順の `segments[]` を返却。
6. content が対応するテキストノードへ翻訳結果を代入。
7. 変異後の `innerHTML` を `saveTranslation` で保存。復元は既存機構をそのまま使用。

## エラー処理

- **local 選択だが API 利用不可**（古い Chrome / 非対応環境）: 明確なエラーを表示。**DeepL への暗黙フォールバックは行わない**（コスト削減が目的であり、意図しない課金を防ぐ）。Chrome 更新またはプロバイダ切替を促すメッセージを出す。
- **モデルダウンロード中**: 「翻訳モデルをダウンロード中…」をカーソル/通知で提示。初回のみ遅延が発生し得る。
- **言語ペア未対応 / 原言語検出失敗**: 個別のエラーメッセージを表示。
- **空白のみのテキストノード**: スキップ。
- 失敗時は既存挙動に倣い、元の DOM を保ち、`alert` でエラーを表示。

## 設定・マニフェスト

- 新ストレージキー `translationProvider`（`'deepl'` | `'local'`、既定 `'deepl'`）。既存ユーザーの挙動は不変。
- Chrome 組込み AI（Translator / Language Detector）は追加の host permission 不要。
- DeepL 用 host permission `https://api.deepl.com/*` は維持。

## テスト方針（モック優先）

現状テスト基盤が無いため **vitest を導入**し、純ロジックを検証する（外部/ブラウザ API はモックしてから手動テストに頼る方針）。

- `Translator` / `LanguageDetector` グローバルをモックし、`local-translator` の availability 各状態・翻訳結果・エラーを検証。
- `text-segments` のノード走査/書き戻しを happy-dom（または jsdom）で検証。
- `chrome.storage` モックで provider 分岐・既定値を検証。
- 最終確認のみ Chrome 138+ で手動スモークテスト。

## スコープ外（YAGNI）

- 言語選択 UI（ソース/ターゲットの手動選択）。当面は自動検出 + ja 固定。
- DeepL 経路のセグメント化など既存挙動の変更。
- Prompt API / WebLLM / Transformers.js 等、他エンジンの実装。

## 段階的実装の指針

1. 共有層（storage の provider 設定、messages の新メッセージ）。
2. background の local-translator と `translate-local` ハンドラ（モックテスト付き）。
3. content の text-segments と translator 分岐（モックテスト付き）。
4. popup のプロバイダ選択 UI。
5. Chrome 138+ での手動スモークテスト。
