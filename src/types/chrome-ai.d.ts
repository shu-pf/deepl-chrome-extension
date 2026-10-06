// Chrome 組込み AI（Translator / Language Detector）の最小型宣言。
// 公式 d.ts が無いため、本拡張で使う範囲のみ宣言する。

type AICapabilityAvailability =
  'unavailable' | 'downloadable' | 'downloading' | 'available';

interface LanguageDetectionResult {
  detectedLanguage: string;
  confidence: number;
}

interface LanguageDetectorInstance {
  detect(text: string): Promise<LanguageDetectionResult[]>;
}

declare const LanguageDetector: {
  availability(): Promise<AICapabilityAvailability>;
  create(): Promise<LanguageDetectorInstance>;
};

interface TranslatorInstance {
  translate(text: string): Promise<string>;
}

declare const Translator: {
  availability(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<AICapabilityAvailability>;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<TranslatorInstance>;
};
