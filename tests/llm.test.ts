// The LLM kind (shared/llm/): the Request card and what is sent come from one plan(), stream and
// tool-call folding, the WAV a mic recording becomes, and the prompt parser. Runs over every LLM
// demo folder and both starters new.sh copies.
import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { LlmFeature } from '../shared/llm/feature'
import { LISTEN_URL, READ_URL, THINK_URL } from '../shared/llm/feature'
import { analysis, emptyFold, foldChunk, plan, splitReasoning, sseEvents, thinkBodies, wav } from '../shared/llm/request'
import { llmPrompt, llmPromptRequests, PROMPT_CALLBACK } from '../shared/llm/prompt'

const demos = await Promise.all(
  readdirSync('demos', { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map(async (d) => [d.name, (await import(`../demos/${d.name}/index.tsx`)).default] as const),
)
const features: [string, LlmFeature<any>][] = [
  ['starter intelligence', (await import('../shared/llm-starters/intelligence.tsx')).default],
  ['starter think', (await import('../shared/llm-starters/think.tsx')).default],
  ...demos.filter(([, f]) => f.kind === 'llm').map(([n, f]) => [n, f] as [string, LlmFeature<any>]),
]

describe.each(features)('llm feature %s', (_name, feature) => {
  it('shows on the Request card exactly what it sends, on every input and variant', () => {
    for (const state of feature.variants) {
      for (const input of feature.inputs) {
        const text = feature.texts(state)[0] ?? ''
        for (const p of plan(feature, state, input.source, text)) {
          const [method, path] = p.shown.line.split(' ')
          expect(method).toBe('POST')
          if (p.api === 'think') {
            expect(path).toBe(THINK_URL)
            expect(JSON.parse(p.shown.body)).toEqual(JSON.parse(p.body!))
          } else {
            expect(`https://api.deepgram.com${path}`).toBe(p.url)
            if (p.api === 'read') expect(JSON.parse(p.shown.body)).toEqual(JSON.parse(p.body!))
            else expect(p.shown.body).toContain(`Content-Type: ${p.contentType}`)
          }
        }
      }
    }
  })

  it('marks something it sends, and offers text to send', () => {
    const state = feature.variants.at(-1)!
    const sent = plan(feature, state, feature.inputs[0].source, feature.texts(state)[0]).map((p) => p.url + (p.body ?? '')).join(' ')
    expect(feature.highlight.some((h) => sent.includes(feature.api === 'think' ? `"${h}"` : `${h}=`))).toBe(true)
    expect(feature.texts(state)[0]?.length).toBeGreaterThan(0)
    if (feature.inputs.some((i) => i.source === 'mic')) expect(feature.phrases?.(state).length).toBeGreaterThan(0)
  })

  it('takes text only when it calls /v1/think', () => {
    if (feature.api === 'think') expect(feature.inputs.map((i) => i.source)).toEqual(['text'])
  })

  it('builds a prompt whose requests are the ones the page sends', () => {
    const md = llmPrompt(feature, { title: 'X | Deepgram', url: 'https://dg-devrel-demos.fly.dev/demos/x/' })
    const reqs = llmPromptRequests(md)
    expect(reqs.length).toBeGreaterThan(0)
    if (feature.api === 'think') {
      const size = (s: unknown) => JSON.stringify([feature.think(s, '')].flat().map((b) => ({ ...b, model: '' }))).length
      const state = feature.variants.reduce((a, s) => (size(s) > size(a) ? s : a))
      expect(reqs[0].json).toEqual(thinkBodies(feature, state, feature.texts(state)[0])[0])
      if (feature.toolExample) expect(reqs.at(-1)!.json!.messages).toHaveLength((reqs[0].json!.messages as unknown[]).length + 2)
    } else {
      expect(reqs.some((r) => r.url.startsWith(READ_URL))).toBe(true)
      if (feature.inputs.some((i) => i.source !== 'text')) expect(reqs.some((r) => r.url.startsWith(LISTEN_URL))).toBe(true)
    }
  })
})

describe('llm requests', () => {
  const intel = features[0][1]
  it('puts language first, and model and smart_format on /v1/listen only', () => {
    const state = intel.variants[0]
    const [read] = plan(intel, state, 'text', 'hi')
    const [listen] = plan(intel, state, 'mic', 'hi')
    expect(read.url).toMatch(/^https:\/\/api\.deepgram\.com\/v1\/read\?language=en&/)
    expect(listen.url).toMatch(/^https:\/\/api\.deepgram\.com\/v1\/listen\?model=nova-3&smart_format=true&language=en&/)
    expect(read.body).toBe('{"text":"hi"}')
    expect(listen.body).toBeUndefined()
  })

  it('adds the callback on text only, and only for a callback feature', () => {
    const cb = { ...intel, callback: true } as LlmFeature<any>
    expect(plan(cb, intel.variants[0], 'text', 'hi', { callback: PROMPT_CALLBACK })[0].url).toContain(`callback=${encodeURIComponent(PROMPT_CALLBACK)}`)
    expect(plan(cb, intel.variants[0], 'mic', 'hi', { callback: PROMPT_CALLBACK })[0].url).not.toContain('callback=')
    expect(plan(intel, intel.variants[0], 'text', 'hi', { callback: PROMPT_CALLBACK })[0].url).not.toContain('callback=')
  })

  it('folds a stream, tool-call arguments in pieces included', () => {
    const { events, rest } = sseEvents(
      'data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"One sec"}}]}\n\n' +
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"get_order_status","arguments":"{\\"order_"}}]}}]}\n\n' +
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"id\\":\\"A1\\"}"}}]}}]}\n\n' +
        'data: {"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}\n\n' +
        'data: {"choices":[],"usage":{"prompt_tokens":3,"completion_tokens":4}}\n\ndata: [DONE]\n\ndata: {"partial',
    )
    expect(rest).toBe('data: {"partial')
    expect(events.at(-1)).toBe('[DONE]')
    const acc = events.slice(0, -1).reduce((a, e) => foldChunk(a, JSON.parse(e)), emptyFold())
    expect(acc.message.content).toBe('One sec')
    expect(acc.message.tool_calls).toEqual([{ id: 'call_1', type: 'function', function: { name: 'get_order_status', arguments: '{"order_id":"A1"}' } }])
    expect(acc.finishReason).toBe('tool_calls')
    expect(acc.usage).toEqual({ prompt_tokens: 3, completion_tokens: 4 })
  })

  it('reads a summary from either endpoint', () => {
    expect(analysis({ results: { summary: { result: 'success', short: 'a' } } }).summary).toBe('a')
    expect(analysis({ results: { summary: { text: 'b' } } }).summary).toBe('b')
    expect(analysis({ results: { channels: [{ alternatives: [{ transcript: 't' }] }] } }).transcript).toBe('t')
  })

  it('splits phoneLLM mini reasoning from the reply', () => {
    expect(splitReasoning('thinking it over\n</think>\nNo, 91 is 7 times 13.')).toEqual({ reasoning: 'thinking it over', reply: 'No, 91 is 7 times 13.' })
    expect(splitReasoning('  Hi there')).toEqual({ reply: 'Hi there' })
  })

  it('wraps mic PCM in a 16 kHz mono 16-bit WAV', () => {
    const out = new DataView(wav([new ArrayBuffer(4), new ArrayBuffer(6)], 16_000))
    expect(out.byteLength).toBe(54)
    expect(String.fromCharCode(...new Uint8Array(out.buffer, 0, 4))).toBe('RIFF')
    expect(out.getUint32(24, true)).toBe(16_000)
    expect(out.getUint16(34, true)).toBe(16)
    expect(out.getUint32(40, true)).toBe(10)
  })
})
