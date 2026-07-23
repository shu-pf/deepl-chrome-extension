# Chrome ウェブストア提出用メモ

提出時にデベロッパーダッシュボードへ入力する内容の下書きと、提出手順のチェックリスト。

## 基本情報

| 項目 | 値 |
|---|---|
| 拡張機能名 | Hover Translator for DeepL API |
| カテゴリ | ツール(Tools)または 仕事効率化(Productivity) |
| 言語 | 日本語 |
| 公開地域 | 日本(説明文が日本語のみのため。英語説明を用意すれば全地域可) |

## 概要(短い説明・132 文字以内)

> DeepL API を使ってページ上の要素をホバー選択して翻訳する非公式の拡張機能。翻訳結果は保存され、再訪問時に自動復元されます。ご自身の DeepL API キーが必要です。

## 詳細説明(下書き)

```
ページ全体ではなく「読みたい部分だけ」を DeepL で翻訳する拡張機能です。
ご自身の DeepL API キー(Free / Pro どちらも対応)を登録して使用します。

■ 使い方
1. ツールバーのアイコンをクリックし、DeepL API キーを登録
2. Cmd+Shift+L(Mac)/ Ctrl+Shift+L で翻訳モードを ON
3. 翻訳したい要素にホバーすると青枠でハイライトされるので、右クリックで日本語に翻訳
4. ESC でモード解除

■ 特徴
・HTML 構造(リンクや装飾)を保ったまま翻訳
・翻訳結果は URL ごとに保存され、次回訪問時に自動で復元
・右クリックメニュー「表示中のページの翻訳を解消する」で元に戻せます
・データはすべてブラウザ内に保存。開発者のサーバーには何も送信しません

■ 注意
・本拡張機能は DeepL SE の公式製品ではない非公式ツールです
・DeepL API キー(https://www.deepl.com/pro-api で取得)が必要です
・翻訳時の API 使用量はご自身の DeepL アカウントに課金・計上されます
```

## 単一用途(Single purpose)の説明

> ユーザーが選択したページ上の要素を DeepL API で翻訳し、その結果を表示・保存・復元すること。

## パーミッションの正当性説明(Permission justification)

| 権限 | 説明文(英語で求められた場合の例) |
|---|---|
| `storage` | ユーザーの DeepL API キーと翻訳結果をローカルに保存するため。<br>To store the user's DeepL API key and translation results locally. |
| `activeTab` | ショートカットキー押下時のアクティブタブへの通知と、コンテキストメニュー操作時に対象ページの URL を取得するため。<br>To message the active tab when the keyboard shortcut is pressed, and to read the page URL when the user clears translations via the context menu. |
| `contextMenus` | 保存済み翻訳を解除する右クリックメニューを提供するため。<br>To provide a right-click menu item that clears saved translations for the current page. |
| `host_permissions`(`api.deepl.com` / `api-free.deepl.com`) | 翻訳リクエストを DeepL API へ送信するため。<br>To send translation requests to the DeepL API. |
| コンテンツスクリプト `<all_urls>` | 本拡張機能の目的は「任意のウェブページ上でユーザーが選択した要素を翻訳する」ことであり、どのページでもホバー選択 UI と翻訳の復元を動作させる必要があるため。ページ内容が自動送信されることはなく、送信はユーザーの明示的な操作(右クリック)時のみ。<br>The extension's sole purpose is to translate elements the user selects on any web page, so the hover-selection UI and translation restoration must work on all pages. Page content is only sent when the user explicitly right-clicks an element — never automatically. |
| リモートコード | 使用しない(No, I am not using remote code)。 |

## プライバシー(データ使用)フォームの回答案

- **ウェブサイトコンテンツ(Website content)**: 収集する → 用途「アプリの機能(App functionality)」。ユーザーが選択した要素の HTML を翻訳のために DeepL API へ送信。
- 個人情報・認証情報・位置情報・閲覧履歴など、その他の項目: **収集しない**
- 認証情報について: DeepL API キーはローカル保存のみで開発者へは送信されないため「収集」には該当しないが、審査で聞かれた場合はその旨を説明する。
- データ使用のコンプライアンス(3 つのチェックボックス): すべて同意可能(第三者への販売なし・単一用途以外での使用/譲渡なし・信用情報等への使用なし)
- **プライバシーポリシー URL**: リポジトリの `PRIVACY.md` を公開した URL を登録する。
  例: `https://github.com/shu-pf/deepl-chrome-extension/blob/main/PRIVACY.md`
  (GitHub Pages で公開する場合はその URL)

## 提出手順チェックリスト

- [ ] [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) にデベロッパー登録(初回のみ $5)
- [ ] `PRIVACY.md` を含む変更を GitHub に push(プライバシーポリシー URL を有効にするため)
- [x] スクリーンショットを撮影(**1280×800 または 640×400、最低 1 枚、最大 5 枚**)
  - 撮影済み: [docs/screenshots/](screenshots/) に 1280×800 で 3 枚(ホバーハイライト / 翻訳後 / ポップアップ)
- [ ] (任意)プロモーションタイル画像 440×280
- [ ] `pnpm compile` && `pnpm build` が通ることを確認
- [ ] `pnpm zip` で `.output/*.zip` を生成し、ダッシュボードにアップロード
- [ ] 掲載情報(本ファイルの説明文・カテゴリ)を入力
- [ ] プライバシータブでデータ使用フォームと単一用途説明を入力
- [ ] パーミッション正当性説明を入力
- [ ] 審査に提出(broad host permissions のため審査に数日〜数週間かかる場合あり)
