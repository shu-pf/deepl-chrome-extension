const API_KEY_STORAGE_KEY = 'deeplApiKey';

export interface TranslationEntry {
  translatedText: string;
  originalHtml: string;
  timestamp: number;
}

export type TranslationMap = Record<string, TranslationEntry>;

function translationStorageKey(url: string): string {
  return `deepl_translations_${url}`;
}

export async function getApiKey(): Promise<string | undefined> {
  const result = await chrome.storage.local.get([API_KEY_STORAGE_KEY]);
  return result[API_KEY_STORAGE_KEY] as string | undefined;
}

export async function setApiKey(key: string): Promise<void> {
  await chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: key });
}

export async function getTranslations(url: string): Promise<TranslationMap> {
  const key = translationStorageKey(url);
  const result = await chrome.storage.local.get([key]);
  return (result[key] as TranslationMap | undefined) ?? {};
}

export async function saveTranslationEntry(
  url: string,
  selector: string,
  entry: TranslationEntry,
): Promise<void> {
  const key = translationStorageKey(url);
  const translations = await getTranslations(url);
  translations[selector] = entry;
  await chrome.storage.local.set({ [key]: translations });
}

export async function clearTranslations(url: string): Promise<void> {
  await chrome.storage.local.remove([translationStorageKey(url)]);
}
