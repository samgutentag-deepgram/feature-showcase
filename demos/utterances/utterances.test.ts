import { describe, expect, it } from 'vitest'
import { readUtterances } from './index'

const res = (extra: object) => ({ results: { channels: [{ alternatives: [{ transcript: 'One. Two.' }] }], ...extra } })

describe('readUtterances', () => {
  it('reads timed utterances with confidence', () => {
    const e = readUtterances(
      res({
        utterances: [
          { start: 0, end: 0.5, confidence: 0.99, channel: 0, transcript: 'One.', words: [], id: 'a' },
          { start: 1.8, end: 2.2, confidence: 0.97, channel: 0, transcript: 'Two.', words: [], id: 'b' },
        ],
      }),
    )
    expect(e?.utterances?.length).toBe(2)
    expect(e?.utterances?.[1]).toEqual({ start: 1.8, end: 2.2, confidence: 0.97, transcript: 'Two.' })
  })
  it('keeps only the transcript when utterances is off', () => {
    expect(readUtterances(res({}))).toEqual({ transcript: 'One. Two.' })
  })
  it('ignores anything that is not a pre-recorded response', () => {
    expect(readUtterances({ type: 'Metadata' })).toBeUndefined()
  })
})
