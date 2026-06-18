const TARGET_LANGUAGE = 'ja';

// 言語ペアごとに Translator インスタンス（の生成 Promise）をキャッシュして再利用する。
const translatorCache = new Map<string, Promise<TranslatorInstance>>();

async function detectSourceLanguage(sample: string): Promise<string> {
  if (typeof LanguageDetector === 'undefined') {
    throw new Error(
      'この環境では言語検出がサポートされていません（Chrome 138 以降が必要です）',
    );
  }
  if ((await LanguageDetector.availability()) === 'unavailable') {
    throw new Error('言語検出モデルが利用できません');
  }
  const detector = await LanguageDetector.create();
  const results = await detector.detect(sample);
  const top = results[0];
  if (!top || !top.detectedLanguage || top.detectedLanguage === 'und') {
    throw new Error('原言語を判定できませんでした');
  }
  return top.detectedLanguage;
}

async function createTranslator(
  sourceLanguage: string,
): Promise<TranslatorInstance> {
  if (typeof Translator === 'undefined') {
    throw new Error(
      'この環境では Translator API がサポートされていません（Chrome 138 以降が必要です）',
    );
  }
  const availability = await Translator.availability({
    sourceLanguage,
    targetLanguage: TARGET_LANGUAGE,
  });
  if (availability === 'unavailable') {
    throw new Error(
      `言語ペア ${sourceLanguage}→${TARGET_LANGUAGE} は利用できません`,
    );
  }
  return Translator.create({
    sourceLanguage,
    targetLanguage: TARGET_LANGUAGE,
  });
}

function getTranslator(sourceLanguage: string): Promise<TranslatorInstance> {
  const cacheKey = `${sourceLanguage}:${TARGET_LANGUAGE}`;
  let cached = translatorCache.get(cacheKey);
  if (!cached) {
    cached = createTranslator(sourceLanguage).catch((error) => {
      translatorCache.delete(cacheKey);
      throw error;
    });
    translatorCache.set(cacheKey, cached);
  }
  return cached;
}

// テスト専用: モジュールレベルの Translator キャッシュをクリアする。
export function _clearTranslatorCacheForTests(): void {
  translatorCache.clear();
}

export async function translateSegments(segments: string[]): Promise<string[]> {
  if (segments.length === 0) return [];

  const sample = segments.join(' ').slice(0, 1000);
  const sourceLanguage = await detectSourceLanguage(sample);
  if (sourceLanguage === TARGET_LANGUAGE) {
    return segments;
  }

  const translator = await getTranslator(sourceLanguage);
  const translated: string[] = [];
  for (const segment of segments) {
    translated.push(await translator.translate(segment));
  }
  return translated;
}
