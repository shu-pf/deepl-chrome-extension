import { requestTranslation } from '../shared/messages';
import { getApiKey, getTranslationProvider } from '../shared/storage';
import { translateSegments } from './local-translator';
import { splitEdgeDecorations } from './edge-decorations';
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
  // 結果は innerHTML に書き戻すので、送るのも中身だけにする。
  // outerHTML を送ると要素が自分自身の中に入れ子になり、リストなどのレイアウトが崩れる。
  const originalHtml = element.outerHTML;
  // 見出し末尾の "#" リンクなどは DeepL に渡すと別の語へ付け替わるので、前後に取り分けておく。
  const { leading, body, trailing } = splitEdgeDecorations(element.innerHTML);
  if (body.trim() === '') {
    return;
  }
  const response = await requestTranslation(body);
  if (!response.success) {
    throw new Error(response.error || '不明なエラー');
  }
  const translatedHtml = leading + response.translatedText + trailing;
  applyTranslation(element, translatedHtml, originalHtml);
  await saveTranslation(element, translatedHtml, originalHtml);
}

async function translateLocal(element: HTMLElement): Promise<void> {
  const originalHtml = element.outerHTML;
  const nodes = collectTextNodes(element);
  if (nodes.length === 0) {
    return;
  }
  const segments = nodes.map((node) => node.nodeValue ?? '');
  // Translator API はドキュメントコンテキスト＋ユーザー操作が必要なため、
  // service worker ではなくこの content script 内で直接実行する。
  const translated = await translateSegments(segments);
  applyTranslatedSegments(nodes, translated);
  const translatedHtml = element.innerHTML;
  applyTranslation(element, translatedHtml, originalHtml);
  await saveTranslation(element, translatedHtml, originalHtml);
}
