export type Message =
  | { action: 'translate'; html: string }
  | { action: 'translate-local'; segments: string[] }
  | { action: 'toggle-hover-mode' };

export type TranslateResponse =
  | { success: true; translatedText: string }
  | { success: false; error: string };

// content → background へ翻訳を依頼する。応答が無い場合は既存挙動と同じエラーを投げる。
export async function requestTranslation(
  html: string,
): Promise<TranslateResponse> {
  const message: Message = { action: 'translate', html };
  const response = (await chrome.runtime.sendMessage(message)) as
    | TranslateResponse
    | undefined;
  if (!response) {
    throw new Error('翻訳サービスからの応答がありません');
  }
  return response;
}

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
