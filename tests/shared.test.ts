import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchToken, requestParams } from '../shared/common/config'
import { closeMessage, finalTranscript, parseFlux, parseNova } from '../shared/stt/stream'
import { loudness } from '../shared/tts/loudness'
import { spread } from '../shared/tts/lineup'
import { defineAgentFeature, listenIdsOf, settingsMessage } from '../shared/agent/feature'
import { agentPrompt, promptRequests } from '../shared/common/prompt'
import { alawToLinear, decodeAgent, encodeMic, linearToAlaw, linearToMulaw, mulawToLinear } from '../shared/agent/codec'

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

// The lineup's loudness numbers: peak, and the RMS of the speech only, silence skipped.
describe('loudness', () => {
  const rate = 24000
  const tone = (amp: number, seconds: number) => Float32Array.from({ length: rate * seconds }, (_, i) => amp * Math.sin((2 * Math.PI * 440 * i) / rate))

  it('reads a half-scale sine as -6 dBFS peak and -9 dBFS speech level', () => {
    const { peakDb, speechDb } = loudness(tone(0.5, 1), rate)
    expect(peakDb).toBeCloseTo(-6.02, 1)
    expect(speechDb).toBeCloseTo(-9.03, 1)
  })

  it('leaves silence out of the speech level', () => {
    const half = tone(0.5, 1)
    const padded = new Float32Array(half.length * 3)
    padded.set(half, half.length)
    expect(loudness(padded, rate).speechDb).toBeCloseTo(loudness(half, rate).speechDb, 1)
  })

  it('says how far apart the loudest and quietest voices are', () => {
    expect(spread([{ voice: 'a', speechDb: -16 }, { voice: 'b', speechDb: -19.5 }, { voice: 'c' }])).toBeCloseTo(3.5)
    expect(spread([{ voice: 'a', speechDb: -16 }])).toBeUndefined()
  })
})

// Voice agent hooks added 2026-11-16 (listenModels, listen, settings, audio, string agent): a feature
// that sets none of them sends exactly the Settings message the shell sent before.
describe('agent Settings message', () => {
  const base = defineAgentFeature<{ on: boolean }>({
    kind: 'agent',
    copy: { headline: '', lede: '', ctaTitle: '', ctaBody: '' },
    links: { docs: '' },
    initialState: { on: true },
    variants: [{ on: true }],
    agent: () => ({ think: { provider: { type: 'open_ai', model: 'gpt-4o-mini' } }, speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } } }),
    highlight: [],
    events: [],
    flushOnUserSpeech: () => true,
    runLabel: () => '',
    phrases: () => [],
    Controls: () => null,
  })

  it('is unchanged for a feature without the new hooks', () => {
    const s = settingsMessage(base, { on: true }, 'flux-general-en')
    expect(JSON.stringify(s)).toBe(
      JSON.stringify({
        type: 'Settings',
        audio: { input: { encoding: 'linear16', sample_rate: 16000 }, output: { encoding: 'linear16', sample_rate: 24000, container: 'none' } },
        agent: { ...(base.agent({ on: true }) as object), listen: { provider: { type: 'deepgram', model: 'flux-general-en' } } },
      }),
    )
    expect(listenIdsOf(base)).toEqual(['flux-general-en', 'nova-3'])
  })

  it('adds listen fields, top-level fields, and audio formats from the hooks', () => {
    const f = {
      ...base,
      listenModels: [{ id: 'flux-general-en', label: 'Flux' }],
      listen: () => ({ version: 'v2', keyterms: ['Deepgram'] }),
      settings: () => ({ tags: ['demo'], flags: { history: false } }),
      audio: () => ({ input: { encoding: 'mulaw', sample_rate: 8000 }, output: { encoding: 'mulaw', sample_rate: 8000, container: 'none' } }) as const,
    }
    const s = settingsMessage(f, { on: true }, 'flux-general-en') as { agent: { listen: unknown }; tags: string[]; audio: { input: { encoding: string } } }
    expect(Object.keys(s)).toEqual(['type', 'tags', 'flags', 'audio', 'agent'])
    expect(s.agent.listen).toEqual({ provider: { type: 'deepgram', model: 'flux-general-en', version: 'v2', keyterms: ['Deepgram'] } })
    expect(s.audio.input.encoding).toBe('mulaw')
  })

  it('sends a stored agent config id as the whole agent, and no listen block with listenModels []', () => {
    const id = '377c136a-5516-4824-8f54-0220d5ce2920'
    expect(settingsMessage({ ...base, listenModels: [], agent: () => id }, { on: true }, '')).toMatchObject({ agent: id })
    const own = settingsMessage({ ...base, listenModels: [] }, { on: true }, '') as { agent: Record<string, unknown> }
    expect(own.agent.listen).toBeUndefined()
    expect(listenIdsOf({ ...base, listenModels: [] })).toEqual([''])
  })
})

describe('agent G.711 codec', () => {
  it.each([0, 1, -1, 100, -100, 1000, -1000, 8000, -8000, 30000, -30000])('round-trips %i through mu-law and A-law within a step', (x) => {
    const tolerance = Math.max(16, Math.abs(x) / 16)
    expect(Math.abs(mulawToLinear(linearToMulaw(x)) - x)).toBeLessThanOrEqual(tolerance)
    expect(Math.abs(alawToLinear(linearToAlaw(x)) - x)).toBeLessThanOrEqual(tolerance)
  })

  it('halves 16 kHz linear16 to 8 kHz, one byte a sample for G.711', () => {
    const pcm = new Int16Array(1600).fill(1000).buffer
    expect(encodeMic(pcm, { encoding: 'linear16', sample_rate: 16000 })).toBe(pcm)
    expect(encodeMic(pcm, { encoding: 'mulaw', sample_rate: 8000 }).byteLength).toBe(800)
    expect(encodeMic(pcm, { encoding: 'linear16', sample_rate: 8000 }).byteLength).toBe(1600)
    expect(decodeAgent(new Uint8Array(encodeMic(pcm, { encoding: 'alaw', sample_rate: 8000 })), 'alaw')[0]).toBeCloseTo(1000 / 32768, 2)
  })
})

describe('agent prompt with the optional hooks', () => {
  const f = defineAgentFeature<{ bad: boolean }>({
    kind: 'agent',
    copy: { headline: '', lede: 'Lede.', ctaTitle: '', ctaBody: '' },
    links: { docs: 'https://developers.deepgram.com/docs/agent-keep-alive' },
    initialState: { bad: false },
    variants: [{ bad: false }, { bad: true }],
    listenModels: [{ id: 'flux-general-en', label: 'Flux' }],
    listen: () => ({ version: 'v2', keyterms: ['Deepgram'] }),
    audio: () => ({ input: { encoding: 'mulaw', sample_rate: 8000 }, output: { encoding: 'mulaw', sample_rate: 8000, container: 'none' } }),
    expects: ({ bad }) => (bad ? { error: 'UNPARSABLE_CLIENT_MESSAGE' } : { warning: 'VOICE_PROMPT_ADDED' }),
    agent: ({ bad }) => ({ think: { provider: { type: 'deepgram', model: 'think-fast' } }, speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en', ...(bad ? { language: 'en', padding: 'x'.repeat(200) } : {}) } } }),
    actions: () => [{ label: 'Mute', message: { type: 'KeepAlive' }, ack: [], mic: 'off', repeatMs: 8000 }],
    highlight: [],
    events: [],
    flushOnUserSpeech: () => true,
    runLabel: () => '',
    phrases: () => ['Hello.'],
    Controls: () => null,
  })
  const md = agentPrompt(f, { title: 'Keep alive | Deepgram', url: 'https://example.com' })

  it('shows the working variant, its listen fields, phone audio, and the silent action', () => {
    const { settings } = promptRequests(md)
    expect(settings).toHaveLength(1)
    expect(JSON.stringify(settings[0])).not.toContain('padding')
    expect(JSON.stringify(settings[0])).toContain('"keyterms":["Deepgram"]')
    expect(md).toContain('8 kHz mono 8-bit mu-law')
    expect(md).toContain('`Warning` whose code is `VOICE_PROMPT_ADDED`')
    expect(md).toContain('then stop sending mic audio, and send it again every 8 s while the mic is off')
    expect(md).toContain('Nothing comes back')
    expect(md).not.toContain('Nova-3')
  })
})
