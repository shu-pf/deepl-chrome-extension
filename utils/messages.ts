// background ↔ content script 間のメッセージ型定義

export interface TranslateRequest {
  action: 'translate';
  html: string;
}

export interface ToggleHoverModeRequest {
  action: 'toggle-hover-mode';
}

export interface CheckApiKeyRequest {
  action: 'check-api-key';
}

export type ExtensionMessage = TranslateRequest | ToggleHoverModeRequest | CheckApiKeyRequest;

export type TranslateResponse =
  | { success: true; translatedText: string }
  | { success: false; error: string };

export interface CheckApiKeyResponse {
  hasApiKey: boolean;
}

export interface StoredTranslation {
  translatedText: string;
  originalHtml: string;
  timestamp: number;
}

export type PageTranslations = Record<string, StoredTranslation>;

export function translationsStorageKey(url: string): string {
  return `deepl_translations_${url}`;
}
