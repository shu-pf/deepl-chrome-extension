# DeepL Chrome Extension

DeepL API を使用して、ページの一部（ホバーで選択した要素）を翻訳する Chrome 拡張機能。
[WXT](https://wxt.dev/) + TypeScript で構築されている。

## 機能

- **ホバー翻訳モード**: `Cmd+Shift+L`（Mac）/ `Ctrl+Shift+L` でモードを ON/OFF。ホバーした要素が青枠でハイライトされ、右クリックでその要素を日本語に翻訳する。`ESC` でモード解除。
- **翻訳の永続化**: 翻訳結果は URL ごとに保存され、次回ページを開いたときに自動で復元される。
- **翻訳の解消**: ページ上で右クリック → コンテキストメニュー「表示中のページの翻訳を解消する」で、保存済み翻訳を削除してリロードする。
- **API キー管理**: ツールバーの拡張機能アイコンをクリックして開くポップアップから DeepL API キーを登録する。

## Chrome 拡張の基礎知識

Chrome 拡張は「1 つのプログラム」ではなく、**役割の異なる複数のスクリプトが別々の環境で動き、メッセージをやり取りする**構成になっている。この拡張で使っているのは次の 3 つ。

| コンポーネント | 実行場所 | できること / できないこと |
|---|---|---|
| **Background (Service Worker)** | ブラウザのバックグラウンド。ページとは無関係に常駐（アイドル時は停止） | 外部 API への fetch、コンテキストメニュー、ショートカットキー検知などの Chrome API が使える。**ページの DOM は触れない** |
| **Content Script** | 閲覧中の各 Web ページに注入される | ページの **DOM を読み書きできる**。使える Chrome API は限定的（storage・メッセージングなど）。外部 API への fetch は CORS 制約を受けるため background に依頼する |
| **Popup** | ツールバーのアイコンをクリックすると開く小さな HTML ページ | 普通の Web ページと同じ。設定 UI に使う。閉じると消える |

これらは実行環境が完全に分かれているため、直接関数を呼び合うことはできず、次の 2 つの手段で連携する。

- **メッセージパッシング**: `browser.runtime.sendMessage()` / `browser.tabs.sendMessage()` で相互にメッセージを送る（この拡張では型を `utils/messages.ts` に定義）
- **共有ストレージ**: `browser.storage.local` は全コンポーネントから読み書きできる共有の Key-Value ストア

## アーキテクチャ図

```mermaid
graph TB
    subgraph Browser["Chrome ブラウザ"]
        subgraph Page["Web ページ（各タブ）"]
            DOM["ページの DOM"]
            CS["Content Script<br/>entrypoints/content.ts<br/>─────────────<br/>・ホバーモードの UI 制御<br/>・要素の HTML 取得と置換<br/>・翻訳の保存/復元"]
            CS -->|"要素の取得・書き換え"| DOM
        end

        BG["Background (Service Worker)<br/>entrypoints/background.ts<br/>─────────────<br/>・DeepL API 呼び出し<br/>・ショートカットキー検知<br/>・コンテキストメニュー管理"]

        Popup["Popup<br/>entrypoints/popup/<br/>─────────────<br/>・API キーの登録 UI"]

        Storage[("browser.storage.local<br/>─────────────<br/>・deeplApiKey<br/>・deepl_translations_&lt;URL&gt;")]
    end

    DeepL["DeepL API<br/>api.deepl.com"]

    CS <-->|"メッセージパッシング<br/>(utils/messages.ts の型)"| BG
    BG -->|"fetch (POST /v2/translate)"| DeepL
    CS <--> Storage
    BG <--> Storage
    Popup -->|"API キー保存"| Storage
```

## 処理フロー

### 1. 翻訳の実行

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant BG as Background
    participant CS as Content Script
    participant ST as storage.local
    participant API as DeepL API

    User->>BG: Cmd+Shift+L（ショートカット）
    BG->>CS: { action: 'toggle-hover-mode' }
    Note over CS: ホバーモード ON<br/>（カーソルが十字に）

    User->>CS: 要素にホバー
    Note over CS: 要素を青枠でハイライト
    User->>CS: 右クリック
    CS->>ST: deeplApiKey を確認
    CS->>BG: { action: 'translate', html: 要素のHTML }
    BG->>ST: deeplApiKey を取得
    BG->>API: POST /v2/translate<br/>(target_lang: JA, tag_handling: html)
    API-->>BG: 翻訳された HTML
    BG-->>CS: { success: true, translatedText }
    Note over CS: 要素の innerHTML を<br/>翻訳結果で置換
    CS->>ST: 翻訳結果を保存<br/>(key: deepl_translations_<URL>)
```

ポイント:

- Content Script は CORS の制約で DeepL API を直接呼べないため、background にメッセージで依頼する。
- `tag_handling: 'html'` を指定して HTML ごと翻訳させることで、リンクや装飾タグの構造を保ったまま翻訳できる。
- 保存時は要素を特定するための **CSS セレクタ**（`#id` や `div.class:nth-of-type(2) > p` のようなパス）をキーとして生成する（`generateSelector()`）。

### 2. 翻訳の復元（ページ再訪問時）

```mermaid
sequenceDiagram
    participant Page as ページ
    participant CS as Content Script
    participant ST as storage.local

    Page->>CS: DOMContentLoaded / load
    Note over CS: 500ms 待機<br/>（SPA のレンダリング完了待ち）
    CS->>ST: deepl_translations_<現在のURL> を取得
    ST-->>CS: { セレクタ: 翻訳データ, ... }
    loop 保存された各セレクタ
        Note over CS: document.querySelector(セレクタ)<br/>で要素を探して innerHTML を置換
    end
```

復元済みの要素には `data-deepl-translated="true"` 属性を付けて二重適用を防ぎ、`data-deepl-original` に元の HTML を保持している。

### 3. 翻訳の解消

コンテキストメニュー「表示中のページの翻訳を解消する」→ background がその URL のストレージキーを削除し、タブをリロードする。

## ストレージの構造

`browser.storage.local` に保存されるデータ:

```
deeplApiKey: "xxxx-xxxx-..."   ← Popup から登録される API キー

deepl_translations_<ページURL>: {
  "<CSSセレクタ>": {
    translatedText: "翻訳後の HTML",
    originalHtml:   "翻訳前の HTML",
    timestamp:      1720000000000
  },
  ...
}
```

## ディレクトリ構成

WXT では `entrypoints/` 配下のファイル名・ディレクトリ名がそのまま拡張機能のコンポーネントとして認識される（`manifest.json` への登録は WXT が自動で行う）。

```
├── entrypoints/
│   ├── background.ts      # Background (Service Worker)
│   ├── content.ts         # Content Script（全 URL に注入）
│   └── popup/             # Popup UI
│       ├── index.html
│       ├── main.ts
│       └── style.css
├── utils/
│   └── messages.ts        # コンポーネント間メッセージの型定義・ストレージキー生成
├── wxt.config.ts          # manifest の設定（permissions・ショートカットキーなど）
└── package.json
```

### WXT について

[WXT](https://wxt.dev/) は Chrome 拡張のビルドフレームワーク。素の拡張機能開発と比べて次の面倒を肩代わりしてくれる。

- `manifest.json` の自動生成（`wxt.config.ts` と `entrypoints/` の構成から生成）
- TypeScript のビルド、`defineBackground` / `defineContentScript` などのヘルパーの自動 import
- `browser` グローバル（Chrome / Firefox 両対応のクロスブラウザ API）の提供
- 開発時の HMR（`pnpm dev` でブラウザが自動起動し、変更が即反映される）

## 開発

```sh
pnpm install        # 依存インストール（postinstall で wxt prepare が走る）
pnpm dev            # 開発モード（Chrome が起動し拡張が読み込まれる）
pnpm build          # 本番ビルド（.output/ に出力）
pnpm zip            # ストア提出用の zip を作成
pnpm compile        # 型チェックのみ（tsc --noEmit）
```

ビルド済みの拡張を手動で読み込む場合は、`chrome://extensions` → デベロッパーモード ON → 「パッケージ化されていない拡張機能を読み込む」で `.output/chrome-mv3/` を指定する。

## 必要な権限（wxt.config.ts）

| 権限 | 用途 |
|---|---|
| `storage` | API キー・翻訳結果の保存 |
| `activeTab` | ショートカット押下時にアクティブタブへメッセージ送信 |
| `contextMenus` | 「翻訳を解消する」メニューの追加 |
| `scripting` | スクリプト注入 |
| `host_permissions: https://api.deepl.com/*` | Background からの DeepL API 呼び出し |
