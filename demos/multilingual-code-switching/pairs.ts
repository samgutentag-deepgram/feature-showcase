// The language pairs a visitor can mix, and one sentence each that switches partway through.

export const PAIRS = {
  'en-es': {
    label: 'English + Spanish',
    langs: ['en', 'es'],
    phrase: "I'll meet you at the office, pero primero tengo que pasar por el supermercado, and then we can grab lunch.",
  },
  'en-fr': {
    label: 'English + French',
    langs: ['en', 'fr'],
    phrase: "Let's go over the slides again, parce que le client arrive à dix heures, so we need to be ready.",
  },
} as const

export type PairId = keyof typeof PAIRS

const names = new Intl.DisplayNames(['en'], { type: 'language' })
export function languageName(code: string): string {
  try {
    return names.of(code) ?? code
  } catch {
    return code
  }
}

// Base language for color: 'es-419' and 'es' get the same color.
export const baseLang = (tag: string) => tag.split('-')[0].toLowerCase()

// Which color a word gets: the pair's first language, its second, or anything else heard.
export function slotFor(lang: string, order: readonly string[]): string {
  if (!lang) return 'unknown'
  const i = order.indexOf(baseLang(lang))
  return i === 0 ? '1' : i === 1 ? '2' : 'other'
}
