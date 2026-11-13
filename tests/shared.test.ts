import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchToken, requestParams } from '../shared/common/config'
import { closeMessage, finalTranscript, parseFlux, parseNova } from '../shared/stt/stream'

// What a stranger sees when something breaks: a sentence that says what to do, no status codes
// on their own and no upstream detail.
describe('error messages', () => {
  afterEach(() => vi.unstubAllGlobals())

  const respond = (status: number) =>
    vi.stubGlobal('fetch', async () => new Response('upstream detail', { status }))

  it.each([
    [429, /wait a minute/i],
    [403, /its own address/i],
    [500, /could not start a session/i],
    [502, /could not start a session/i],
  ])('explains a %i from the token route', async (status, message) => {
    respond(status)
    await expect(fetchToken()).rejects.toThrow(message)
  })

  it('explains a network failure', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(fetchToken()).rejects.toThrow(/check your connection/i)
  })

  it('says what to do when Deepgram closes the socket early, with the code for a bug report', () => {
    expect(closeMessage(1011)).toMatch(/^Deepgram hit a problem.*Try again.*\(1011\)$/)
    expect(closeMessage(1006)).toMatch(/closed early\. Try again\. \(1006\)$/)
    expect(closeMessage(1008, 'DATA-0000')).toMatch(/\(1008: DATA-0000\)$/)
  })
})

describe('parsers', () => {
  const results = {
    type: 'Results',
    is_final: true,
    channel: {
      alternatives: [{
        transcript: 'bon dia hola',
        languages: ['ca', 'es'],
        words: [
          { word: 'bon', punctuated_word: 'Bon', language: 'ca', speaker: 0 },
          { word: 'dia', punctuated_word: 'dia,', language: 'ca', speaker: 0 },
          { word: 'hola', language: 'es', speaker: 1 },
          { word: 'adeu', speaker: 1 },
        ],
      }],
    },
  }

  it('reads language and speaker per word from a Nova-3 Results message', () => {
    const u = parseNova(results)
    expect(u?.final).toBe(true)
    expect(u?.words).toEqual([
      { text: 'Bon', lang: 'ca', speaker: 0 },
      { text: 'dia,', lang: 'ca', speaker: 0 },
      { text: 'hola', lang: 'es', speaker: 1 },
      // No language on the word: the alternative's top language stands in.
      { text: 'adeu', lang: 'ca', speaker: 1 },
    ])
  })

  it('leaves speaker off when diarize is off', () => {
    const u = parseNova({ type: 'Results', channel: { alternatives: [{ words: [{ word: 'hi' }] }] } })
    expect(u?.words).toEqual([{ text: 'hi', lang: '' }])
  })

  it('tags a whole Flux turn with its top language', () => {
    const msg = { type: 'TurnInfo', event: 'EndOfTurn', transcript: 'Hello there', languages: ['en'] }
    expect(parseFlux(msg)).toEqual({
      final: true,
      words: [{ text: 'Hello', lang: 'en' }, { text: 'there', lang: 'en', endsTurn: true }],
      raw: msg,
    })
  })

  it('ignores messages that carry no transcript', () => {
    expect(parseNova({ type: 'Metadata' })).toBeNull()
    expect(parseFlux({ type: 'Connected' })).toBeNull()
  })
})

describe('finalTranscript', () => {
  it('reads a final Nova result and a Flux end of turn, and nothing else', () => {
    expect(finalTranscript({ type: 'Results', is_final: true, channel: { alternatives: [{ transcript: 'Hi.' }] } })).toBe('Hi.')
    expect(finalTranscript({ type: 'Results', is_final: false, channel: { alternatives: [{ transcript: 'Hi' }] } })).toBeUndefined()
    expect(finalTranscript({ type: 'TurnInfo', event: 'EndOfTurn', transcript: 'Hello there' })).toBe('Hello there')
    expect(finalTranscript({ type: 'TurnInfo', event: 'Update', transcript: 'Hello' })).toBeUndefined()
  })
})

describe('turn ends', () => {
  it('marks the last word of a Nova speech_final result', () => {
    const msg = { type: 'Results', is_final: true, speech_final: true, channel: { alternatives: [{ words: [{ word: 'a' }, { word: 'b' }] }] } }
    expect(parseNova(msg)?.words.map((w) => !!w.endsTurn)).toEqual([false, true])
    expect(parseNova({ ...msg, speech_final: false })?.words.some((w) => w.endsTurn)).toBe(false)
  })
})

describe('requestParams', () => {
  const nova = { id: 'nova-3', label: 'Nova-3', endpoint: 'v1' as const, params: { model: 'nova-3' } }
  it('streams interim results on Nova unless the feature says otherwise', () => {
    expect(requestParams(nova, {})).toMatchObject({ interim_results: 'true' })
    expect(requestParams(nova, { interim_results: 'false' })).toMatchObject({ interim_results: 'false' })
  })
})
