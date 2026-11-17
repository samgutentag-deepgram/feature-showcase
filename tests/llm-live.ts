// The live checks for LLM-kind features (shared/llm/), called from tests/live.test.ts. They send
// requests through the same plan() and send functions the page uses, so a pass means the page's
// own requests work. Reads DEEPGRAM_API_KEY from the environment and never prints it.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { SAMPLE_RATE } from '../shared/common/config'
import type { Json } from '../shared/common/feature'
import type { LlmFeature, Source } from '../shared/llm/feature'
import { audioType, plan, RequestError, runThinkLane, sendOnce, thinkBodies, wav, type Auth } from '../shared/llm/request'
import { llmPromptRequests, PROMPT_CALL_ID } from '../shared/llm/prompt'
import { TOKEN_TTL_SECONDS } from '../shared/common/prompt'

// Where a callback check asks Deepgram to deliver. Reserved for examples (RFC 2606): Deepgram
// resolves it and answers with a request_id, and nothing real gets the result.
export const CHECK_CALLBACK = 'https://example.com/read-callback'

const key: Auth = async () => `Token ${process.env.DEEPGRAM_API_KEY}`

export async function granted(): Promise<string> {
  const res = await fetch('https://api.deepgram.com/v1/auth/grant', {
    method: 'POST',
    headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl_seconds: TOKEN_TTL_SECONDS }),
  })
  if (res.status !== 200) throw new Error(`grant -> ${res.status}`)
  return (await res.json()).access_token
}
const bearer: Auth = async () => `Bearer ${await granted()}`

// Retries a 429 (the key is shared) a few times, a second and a half apart.
async function retry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (!(err instanceof RequestError && err.status === 429) || attempt >= 3) throw err
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
}

// Aura-2 reading the text, as 16 kHz PCM wrapped the way the page wraps a mic recording.
async function spoken(text: string): Promise<ArrayBuffer> {
  const q = new URLSearchParams({ model: 'aura-2-thalia-en', encoding: 'linear16', sample_rate: String(SAMPLE_RATE), container: 'none' })
  const res = await fetch(`https://api.deepgram.com/v1/speak?${q}`, {
    method: 'POST',
    headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (res.status !== 200) throw new Error(`speak -> ${res.status}`)
  return wav([await res.arrayBuffer()], SAMPLE_RATE)
}

// A bundled clip: the import URL (`/demos/<id>/sample.mp3` in Vite and Vitest) read from disk.
function sampleBytes(url: string): ArrayBuffer {
  const file = path.join(process.cwd(), url.split('?')[0].replace(/^\//, ''))
  if (!existsSync(file)) throw new Error(`sample clip ${url} is not on disk at ${file}`)
  const b = readFileSync(file)
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
}

// Each analysis a request asks for must come back under results.
const EXPECT: Record<string, string> = { summarize: 'summary', topics: 'topics', intents: 'intents', sentiment: 'sentiments' }
function missing(json: Json | undefined, url: string): string[] {
  const q = new URL(url).searchParams
  const results = (json?.results ?? {}) as Json
  return Object.entries(EXPECT)
    .filter(([p, r]) => q.has(p) && q.get(p) !== 'false' && !(r in results))
    .map(([, r]) => `no results.${r}`)
}

// Every variant on every input the page offers, exactly as the page sends it. Returns failures.
export async function llmEveryVariant<S>(feature: LlmFeature<S>): Promise<string[]> {
  const failed: string[] = []
  const sources = [...new Set(feature.inputs.map((i) => i.source))] as Source[]
  for (const state of feature.variants) {
    const text = feature.texts(state)[0] ?? ''
    if (feature.api === 'think') {
      for (const body of thinkBodies(feature, state, text)) {
        const what = `/v1/think ${body.model} ${JSON.stringify(state)}`
        try {
          const lane = await retry(() => runThinkLane(feature, state, body, key))
          if (!lane.reply?.trim() && !lane.calls?.length) failed.push(`${what} -> empty reply`)
          const ex = feature.toolExample
          if (ex && feature.onToolCall) {
            const call = lane.calls?.[0]
            if (!call || call.name !== ex.name || JSON.stringify(call.args) !== JSON.stringify(ex.args)) {
              failed.push(`${what} -> expected ${ex.name}(${JSON.stringify(ex.args)}), got ${JSON.stringify(lane.calls)}`)
            } else if (!lane.reply?.trim()) failed.push(`${what} -> no reply after the tool result`)
          }
        } catch (err) {
          failed.push(`${what} -> ${(err as Error).message} ${(err as RequestError).detail ?? ''}`)
        }
      }
      continue
    }
    for (const source of sources) {
      const callback = feature.callback && source === 'text' ? CHECK_CALLBACK : undefined
      const audio = source === 'sample' && feature.sample ? { note: 'the sample clip', type: audioType(feature.sample.url) } : undefined
      const [req] = plan(feature, state, source, text, { callback, audio })
      try {
        const body =
          source === 'mic' ? await spoken((feature.phrases?.(state) ?? [text]).join(' ')) : source === 'sample' ? sampleBytes(feature.sample!.url) : undefined
        const ex = await retry(() => sendOnce(req, key, body))
        if (callback) {
          if (!ex.json?.request_id) failed.push(`${req.shown.line} -> no request_id`)
        } else failed.push(...missing(ex.json, req.url).map((m) => `${req.shown.line} -> ${m}`))
      } catch (err) {
        failed.push(`${req.shown.line} -> ${(err as Error).message} ${(err as RequestError).detail ?? ''}`)
      }
    }
  }
  return failed
}

// Every POST a prompt.md shows, with a granted token as Bearer, the way the prompt says to send it.
export async function llmPromptLive<S>(md: string, feature: LlmFeature<S>): Promise<string[]> {
  const failed: string[] = []
  const requests = llmPromptRequests(md)
  if (!requests.length) return ['prompt.md shows no request']
  for (const r of requests) {
    try {
      const auth = await bearer()
      const audio = r.url.includes('/v1/listen')
      const state = feature.variants.at(-1)!
      const body = audio ? await spoken((feature.phrases?.(state) ?? feature.texts(state)).join(' ')) : r.body
      const res = await fetch(r.url, { method: 'POST', headers: { Authorization: auth, 'Content-Type': audio ? 'audio/wav' : r.contentType }, body })
      const text = await res.text()
      if (res.status !== 200) {
        failed.push(`${r.url} -> ${res.status} ${text.slice(0, 200)}`)
        continue
      }
      if ((r.json as { stream?: boolean } | undefined)?.stream && !text.includes('data: [DONE]')) failed.push(`${r.url} -> stream without [DONE]`)
      const toolRound = JSON.stringify(r.json ?? {}).includes(PROMPT_CALL_ID)
      if (toolRound && !/"content"\s*:\s*"[^"]/.test(text) && !/"delta":\{"content":"[^"]/.test(text)) failed.push(`${r.url} -> no reply after the tool result`)
    } catch (err) {
      failed.push(`${r.url} -> ${(err as Error).message}`)
    }
  }
  return failed
}
