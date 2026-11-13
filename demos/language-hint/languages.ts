// Which languages each model accepts as a hint, and their display names.

// Nova-3 multilingual: the 55-language model behind language=multi.
// https://developers.deepgram.com/docs/nova-3-language-prompting
export const NOVA3_LANGUAGES = [
  'af', 'ar', 'be', 'bn', 'bs', 'bg', 'ca', 'zh-HK', 'zh', 'hr', 'cs', 'da', 'nl', 'en', 'et',
  'fi', 'nl-BE', 'fr', 'gl', 'de', 'el', 'gu', 'he', 'hi', 'hu', 'id', 'it', 'ja', 'kn', 'ko',
  'lv', 'lt', 'mk', 'ms', 'mr', 'no', 'fa', 'pl', 'pt', 'ro', 'ru', 'sr', 'sk', 'sl', 'es', 'sv',
  'tl', 'ta', 'te', 'th', 'tr', 'uk', 'vi', 'xh', 'zu',
] as const

// flux-general-multi covers ten languages. Catalan is not one of them.
// https://developers.deepgram.com/docs/flux/language-prompting
export const FLUX_LANGUAGES = ['en', 'es', 'fr', 'de', 'hi', 'ru', 'pt', 'ja', 'it', 'nl'] as const

const names = new Intl.DisplayNames(['en'], { type: 'language' })
export function languageName(code: string): string {
  try {
    return names.of(code) ?? code
  } catch {
    return code
  }
}

// One test sentence per language, for the "Try saying" card. The same sentence in each, so a
// visitor can read one line, switch, and read the next. Languages without one get a prompt instead.
export const PHRASES: Record<string, string> = {
  en: "Today I'm testing language detection.",
  es: 'Hoy estoy probando la detección de idioma.',
  ca: "Avui estic provant la detecció d'idioma.",
  fr: "Aujourd'hui, je teste la détection de langue.",
  de: 'Heute teste ich die Spracherkennung.',
  it: 'Oggi sto provando il riconoscimento della lingua.',
  pt: 'Hoje estou testando a detecção de idioma.',
  nl: 'Vandaag test ik taalherkenning.',
  ru: 'Сегодня я тестирую определение языка.',
  ja: '今日は言語検出をテストしています。',
  hi: 'आज मैं भाषा पहचान का परीक्षण कर रहा हूँ।',
}

export const phraseFor = (code: string) => PHRASES[code] ?? `(Say a sentence in ${languageName(code)}.)`
