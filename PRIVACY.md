# プライバシーポリシー / Privacy Policy

**Hover Translator for DeepL API**(以下「本拡張機能」)のプライバシーポリシーです。

制定日: 2026-07-23

## 収集・送信されるデータ

本拡張機能は、開発者のサーバーを持ちません。開発者がユーザーのデータを収集・閲覧することは一切ありません。

### 1. DeepL API へ送信されるデータ

ユーザーが翻訳対象として明示的に選択(ホバー + 右クリック)したページ要素の HTML コンテンツのみが、翻訳のために DeepL SE の API サーバー(`api.deepl.com` または `api-free.deepl.com`)へ送信されます。

- 送信はユーザーの操作をトリガーとした場合にのみ行われます。バックグラウンドで自動的にページ内容が送信されることはありません。
- DeepL 社によるデータの取り扱いは [DeepL のプライバシーポリシー](https://www.deepl.com/privacy) に従います。

### 2. ローカルに保存されるデータ

以下のデータはブラウザ内のローカルストレージ(`browser.storage.local`)にのみ保存され、外部に送信されることはありません。

- **DeepL API キー**: ユーザーが設定画面(ポップアップ)から登録したもの。
- **翻訳結果**: ページ再訪問時に翻訳を復元するため、URL ごとに翻訳前後の HTML を保存します。保存から 30 日を経過したデータは自動的に削除されます。

## 収集しないデータ

- 閲覧履歴、個人情報、認証情報などを収集しません。
- アクセス解析・トラッキング・広告は一切行いません。
- 第三者へのデータの販売・譲渡は行いません(翻訳処理のための DeepL API への送信を除く)。

## データの削除方法

- 保存された翻訳結果は、ポップアップの「保存した翻訳をすべて削除」ボタン、または各ページのコンテキストメニュー「表示中のページの翻訳を解消する」から削除できます。
- 本拡張機能をアンインストールすると、保存されたすべてのデータ(API キーを含む)が削除されます。

## お問い合わせ

本ポリシーに関する質問は [GitHub リポジトリの Issues](https://github.com/shu-pf/deepl-chrome-extension/issues) までお願いします。

---

# Privacy Policy (English)

Effective date: 2026-07-23

**Hover Translator for DeepL API** (the "Extension") does not operate any server. The developer never collects or accesses any user data.

- **Data sent to DeepL**: Only the HTML content of the page element the user explicitly selects for translation is sent to DeepL SE's API servers (`api.deepl.com` / `api-free.deepl.com`), solely for translation. No page content is ever sent automatically in the background. DeepL's handling of this data is governed by the [DeepL Privacy Policy](https://www.deepl.com/privacy).
- **Data stored locally**: The user's DeepL API key and translation results are stored only in the browser's local storage (`browser.storage.local`) and are never transmitted elsewhere. Stored translations are automatically deleted after 30 days.
- **No tracking**: The Extension collects no browsing history or personal information, uses no analytics or advertising, and never sells or shares data with third parties (other than sending selected text to the DeepL API for translation).
- **Data deletion**: Stored data can be removed from the Extension's popup or context menu, and all data is deleted when the Extension is uninstalled.

For questions, please open an issue on the [GitHub repository](https://github.com/shu-pf/deepl-chrome-extension/issues).
