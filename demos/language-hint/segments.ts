// Turns a flat run of words into rows: a new row starts wherever the language changes.
import type { Word } from '../../shared/common/feature'

export interface Segment {
  lang: string
  words: Word[]
}

export function groupByLanguage(words: readonly Word[]): Segment[] {
  const rows: Segment[] = []
  for (const w of words) {
    const last = rows.at(-1)
    // An untagged word (common on interim results) stays with the row it follows.
    const lang = w.lang || last?.lang || ''
    if (last && last.lang === lang) last.words.push({ ...w, lang })
    else rows.push({ lang, words: [{ ...w, lang }] })
  }
  return rows
}

// Base language for color and label: 'es-419' and 'es' are the same row color.
export function baseLang(tag: string): string {
  return tag.split('-')[0].toLowerCase()
}

// Color order for rows: the hints when there are some, otherwise languages in the order heard.
export function colorOrder(hints: readonly string[], words: readonly Word[]): string[] {
  const seen = hints.map(baseLang)
  for (const w of words) {
    const b = w.lang && baseLang(w.lang)
    if (b && !seen.includes(b)) seen.push(b)
  }
  return seen
}
