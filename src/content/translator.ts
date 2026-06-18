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
