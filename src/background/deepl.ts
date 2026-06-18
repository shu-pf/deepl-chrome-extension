export async function translateText(
  html: string,
  apiKey: string,
): Promise<string> {
  const response = await fetch('https://api.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [html],
      target_lang: 'JA',
      tag_handling: 'html',
      tag_handling_version: 'v2',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepL APIエラー: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as {
    translations?: Array<{ text: string }>;
  };
  if (data.translations && data.translations.length > 0) {
    return data.translations[0].text;
  }
  throw new Error('翻訳結果が取得できませんでした');
}
