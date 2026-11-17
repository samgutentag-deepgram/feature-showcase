import { describe, expect, it } from 'vitest'
import { readParagraphs } from './index'

const alt = (extra: object) => ({ results: { channels: [{ alternatives: [{ transcript: 'One. Two.', ...extra }] }] } })

describe('readParagraphs', () => {
  it('reads paragraphs and timed sentences', () => {
    const e = readParagraphs(
      alt({
        paragraphs: {
          transcript: '\nOne.\n\nTwo.',
          paragraphs: [
            { sentences: [{ text: 'One.', start: 0, end: 0.5 }], num_words: 1, start: 0, end: 0.5 },
            { sentences: [{ text: 'Two.', start: 1.2, end: 1.6 }], num_words: 1, start: 1.2, end: 1.6 },
          ],
        },
      }),
    )
    expect(e?.paragraphs?.length).toBe(2)
    expect(e?.paragraphs?.[1].sentences[0]).toEqual({ text: 'Two.', start: 1.2, end: 1.6 })
  })
  it('keeps only the transcript when paragraphs is off', () => {
    expect(readParagraphs(alt({}))).toEqual({ transcript: 'One. Two.' })
  })
  it('ignores anything that is not a pre-recorded response', () => {
    expect(readParagraphs({ type: 'Metadata' })).toBeUndefined()
  })
})
