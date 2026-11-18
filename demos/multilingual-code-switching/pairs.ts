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
  // Checked 2026-11-18 with a macOS Lekha clip: Flux flux-general-multi wrote it word for word with
  // languages ["en","hi"] 3 of 3; Nova-3 language=multi tagged every word right 3 of 3 (one run
  // heard "can" as "can't"). "office" stays in Latin script: both models write it that way.
  'en-hi': {
    label: 'English + Hindi',
    langs: ['en', 'hi'],
    phrase: "I'll call you after the meeting, क्योंकि अभी मैं office में हूं, and then we can talk properly.",
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
