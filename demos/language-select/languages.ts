// The languages the picker offers and the line to read in each.

// Every one checked live on Nova-3 streaming (2026-11-16): language=<code> with the line below,
// read by a macOS voice, came back word for word. Kept to the ten Flux multilingual covers too,
// so the same list carries over if Flux ever takes language.
export const LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ja', 'hi', 'ru'] as const
export type Lang = (typeof LANGUAGES)[number]

const names = new Intl.DisplayNames(['en'], { type: 'language' })
export function languageName(code: string): string {
  try {
    return names.of(code) ?? code
  } catch {
    return code
  }
}

// English first, then the rest by name.
export const SORTED: readonly Lang[] = [
  'en',
  ...LANGUAGES.filter((c) => c !== 'en').sort((a, b) => languageName(a).localeCompare(languageName(b))),
]

// The same short sentence in each language, so two runs are easy to compare.
export const PHRASES: Record<Lang, string> = {
  en: "I'd like a table for two by the window, please.",
  es: 'Quiero una mesa para dos junto a la ventana, por favor.',
  fr: "Je voudrais une table pour deux près de la fenêtre, s'il vous plaît.",
  de: 'Ich hätte gern einen Tisch für zwei am Fenster, bitte.',
  it: 'Vorrei un tavolo per due vicino alla finestra, per favore.',
  pt: 'Eu queria uma mesa para dois perto da janela, por favor.',
  nl: 'Ik wil graag een tafel voor twee bij het raam, alstublieft.',
  ja: '窓際の二人用のテーブルをお願いします。',
  hi: 'कृपया खिड़की के पास दो लोगों के लिए एक टेबल दीजिए।',
  ru: 'Мне, пожалуйста, столик на двоих у окна.',
}
