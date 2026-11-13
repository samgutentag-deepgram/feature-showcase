// Pre-deploy check, against the real API: every request the page can show is opened as a socket
// exactly as the page would open it, for every model, mode, and variant. A param Deepgram rejects
// fails the handshake here instead of on the live page. Also checks the docs links resolve.
//
//   pnpm verify:live
//
// Skipped in plain `pnpm test` and in CI. Reads DEEPGRAM_API_KEY from .env and never prints it.
import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { describeRequest, requestParams, toQuery } from '../shared/common/config'
import type { Feature, Model, Params } from '../shared/common/feature'
import type { TtsFeature } from '../shared/tts/feature'
import { speakPath, speakQuery } from '../shared/tts/speak'
import { cutMessage, socketUrl } from '../shared/tts/socket'
import { ttsPromptRequests } from '../shared/tts/prompt'
import { LISTEN_URL } from '../shared/tts/listen'
import { pieces, sessionUrl } from '../shared/tts/session'
import { tokenize, tokenUrl } from '../shared/tts/tokens'

// The voice cut-in socket: opens with the key, takes a second of silence, and closes cleanly.
function probeListen(): Promise<string> {
  return new Promise((resolve) => {
    const ws = new WebSocket(LISTEN_URL, ['token', process.env.DEEPGRAM_API_KEY ?? ''])
    const timer = setTimeout(() => (ws.close(), resolve('timed out')), 15_000)
    ws.onopen = () => (ws.send(new ArrayBuffer(32_000)), ws.send(JSON.stringify({ type: 'CloseStream' })))
    ws.onerror = () => {}
    ws.onclose = (e) => (clearTimeout(timer), resolve([1000, 1005].includes(e.code) ? 'ok' : `closed ${e.code} ${e.reason}`))
  })
}
import { AGENT_URL, INPUT_RATE, LISTEN_MODELS, settingsMessage, type AgentAction, type AgentFeature } from '../shared/agent/feature'
import { existsSync, readFileSync } from 'node:fs'
import { promptRequests, TOKEN_TTL_SECONDS } from '../shared/common/prompt'

const LIVE = process.env.LIVE === '1'
if (LIVE) {
  try {
    process.loadEnvFile('.env')
  } catch {
    // Fall through: the key may already be in the environment.
  }
}

// ONLY=keyterm,redact limits the live run to those demos (scripts/check.sh sets it per demo).
const only = process.env.ONLY?.split(',').filter(Boolean)
const names = readdirSync('demos', { withFileTypes: true })
  .filter((d) => d.isDirectory() && (!only || only.includes(d.name)))
  .map((d) => d.name)

interface Probe {
  opened: boolean
  code: number
  reason: string
}

// Opens the socket, sends half a second of silence, then asks Deepgram to finish.
function probe(model: Model, params: Params): Promise<Probe> {
  const url = `wss://api.deepgram.com/${model.endpoint}/listen?${toQuery(requestParams(model, params))}`
  return new Promise((resolve) => {
    const ws = new WebSocket(url, ['token', process.env.DEEPGRAM_API_KEY ?? ''])
    let opened = false
    const timer = setTimeout(() => {
      ws.close()
      resolve({ opened, code: -1, reason: 'timed out' })
    }, 15_000)
    ws.onopen = () => {
      opened = true
      ws.send(new ArrayBuffer(16_000))
      ws.send(JSON.stringify({ type: 'CloseStream' }))
    }
    ws.onerror = () => {}
    ws.onclose = (e) => {
      clearTimeout(timer)
      resolve({ opened, code: e.code, reason: e.reason })
    }
  })
}

// Text-to-speech: every variant with every voice, as the page would send it. Each must return audio
// of the encoding asked for.
// Socket mode: the page's whole exchange for every voice and variant. Speak the first phrase, cut
// in once audio is flowing (with Interrupt or Clear when the variant sends one), speak the reply,
// and wait for the reply's turn to end. Any Error, a missing ack, or no reply audio fails.
async function cutInEveryVariant(feature: TtsFeature<unknown>) {
  const cutIn = feature.cutIn!
  if (cutIn.listen) {
    const r = await probeListen()
    expect(r, LISTEN_URL).toBe('ok')
  }
  const one = (voice: string, state: unknown) =>
    new Promise<string>((resolve) => {
      const flux = voice.startsWith('flux-')
      const interrupt = cutIn.interrupt(state)
      const ws = new WebSocket(socketUrl(voice, feature.params(state)), ['token', process.env.DEEPGRAM_API_KEY ?? ''])
      ws.binaryType = 'arraybuffer'
      let bytes = 0
      let cut = false
      let acked = false
      let replyBytes = 0
      let turns = 0
      const end = (r: string) => (clearTimeout(timer), ws.close(), resolve(r))
      const timer = setTimeout(() => end(`timed out (bytes ${bytes}, cut ${cut}, acked ${acked})`), 30_000)
      ws.onopen = () => (ws.send(JSON.stringify({ type: 'Speak', text: feature.phrases[0] })), ws.send(JSON.stringify({ type: 'Flush' })))
      ws.onerror = () => end('socket error')
      ws.onmessage = (e) => {
        if (typeof e.data !== 'string') {
          bytes += (e.data as ArrayBuffer).byteLength
          if (cut && (acked || !interrupt)) replyBytes += (e.data as ArrayBuffer).byteLength
          if (!cut && bytes > 24_000) {
            cut = true
            if (interrupt) ws.send(JSON.stringify(cutMessage(voice, 500)))
            ws.send(JSON.stringify({ type: 'Speak', text: cutIn.reply }))
            ws.send(JSON.stringify({ type: 'Flush' }))
          }
          return
        }
        const m = JSON.parse(e.data)
        if (m.type === 'Error' || m.type === 'Warning') return end(`${m.type}: ${e.data.slice(0, 200)}`)
        if (m.type === (flux ? 'SpeechInterrupted' : 'Cleared')) {
          acked = true
          if (flux && typeof m.text_spoken !== 'string') return end('SpeechInterrupted without text_spoken')
        }
        if (m.type === (flux ? 'SpeechMetadata' : 'Flushed')) turns++
        // Interrupted: the line's turn ends in the ack, so the reply's is the first. Otherwise the second.
        if (turns === (interrupt ? 1 : 2) && cut) {
          if (interrupt && !acked) return end('no ack')
          end(replyBytes > 1000 ? 'ok' : `reply had ${replyBytes} bytes`)
        }
      }
    })
  const results = await Promise.all(
    feature.voices.flatMap((voice) => feature.variants.map(async (state) => ({ what: `${socketUrl(voice, feature.params(state))} ${JSON.stringify(state)}`, r: await one(voice, state) }))),
  )
  expect(results.filter((x) => x.r !== 'ok').map((x) => `${x.what} -> ${x.r}`)).toEqual([])
}

// Every voice with every variant, 8 at a time (a voice browser has hundreds), retrying a 429.
// Session mode: one socket per voice, every variant in turn, each a turn of its own (Configure
// first when the variant has one). Each must answer ConfigureSuccess when configured, and every
// turn must end in SpeechMetadata with a new speech_id, audio and billable characters.
async function sessionEveryVariant(feature: TtsFeature<unknown>) {
  const session = feature.session!
  const one = (voice: string) =>
    new Promise<string>((resolve) => {
      const state0 = feature.variants[0]
      const ws = new WebSocket(sessionUrl(voice, feature.params(state0), Object.keys(session.configure?.(state0) ?? {})), ['token', process.env.DEEPGRAM_API_KEY ?? ''])
      ws.binaryType = 'arraybuffer'
      const ids = new Set<string>()
      let i = 0
      let ok = 0
      let bytes = 0
      const end = (r: string) => (clearTimeout(timer), ws.close(), resolve(r))
      const timer = setTimeout(() => end(`timed out at variant ${i}`), 45_000)
      const turn = () => {
        if (session.configure) ws.send(JSON.stringify({ type: 'Configure', ...session.configure(feature.variants[i]) }))
        ws.send(JSON.stringify({ type: 'Speak', text: pieces(feature.phrases[0], session.split)[0] }))
        ws.send(JSON.stringify({ type: 'Flush' }))
      }
      ws.onopen = turn
      ws.onerror = () => end('socket error')
      ws.onmessage = (e) => {
        if (typeof e.data !== 'string') return void (bytes += (e.data as ArrayBuffer).byteLength)
        const m = JSON.parse(e.data)
        if (m.type === 'Error' || m.type === 'Warning' || m.type === 'ConfigureFailure') return end(`${m.type}: ${e.data.slice(0, 200)}`)
        if (m.type === 'ConfigureSuccess') ok++
        if (m.type === 'SpeechMetadata') {
          if (session.configure && ok !== i + 1) return end(`variant ${i}: ${ok} configured`)
          if (!m.speech_id || ids.has(m.speech_id) || bytes < 1000 || !(m.billable_character_count > 0)) return end(`variant ${i}: ${e.data.slice(0, 200)}, ${bytes} bytes`)
          ids.add(m.speech_id)
          bytes = 0
          if (++i === feature.variants.length) return end('ok')
          turn()
        }
      }
    })
  const results = await Promise.all(feature.voices.map(async (v) => ({ v, r: await one(v) })))
  expect(results.filter((x) => x.r !== 'ok').map((x) => `${x.v} -> ${x.r}`)).toEqual([])
}

// Token mode: every voice and mode, exactly as the page sends it (token by token, or whole), with
// tokens 20 ms apart to keep it quick. The turn must end in SpeechMetadata with audio and no Warning.
async function tokensEveryVariant(feature: TtsFeature<unknown>) {
  const tokens = feature.tokens!
  const one = (voice: string, state: unknown) =>
    new Promise<string>((resolve) => {
      const ws = new WebSocket(tokenUrl(voice, feature.params(state)), ['token', process.env.DEEPGRAM_API_KEY ?? ''])
      ws.binaryType = 'arraybuffer'
      let bytes = 0
      const end = (r: string) => (clearTimeout(timer), ws.close(), resolve(r))
      const timer = setTimeout(() => end(`timed out, ${bytes} bytes`), 45_000)
      ws.onopen = async () => {
        const mode = tokens.mode(state)
        const text = feature.phrases[0]
        if (mode === 'whole') ws.send(JSON.stringify({ type: 'Speak', text }))
        else for (const t of tokenize(text)) (ws.send(JSON.stringify({ type: 'Speak', text: t })), await new Promise((r) => setTimeout(r, 20)))
        if (mode === 'late') await new Promise((r) => setTimeout(r, 500))
        ws.send(JSON.stringify({ type: 'Flush' }))
      }
      ws.onerror = () => end('socket error')
      ws.onmessage = (e) => {
        if (typeof e.data !== 'string') return void (bytes += (e.data as ArrayBuffer).byteLength)
        const m = JSON.parse(e.data)
        if (m.type === 'Error' || m.type === 'Warning') return end(`${m.type}: ${e.data.slice(0, 200)}`)
        if (m.type === 'SpeechMetadata') end(bytes > 1000 ? 'ok' : `${bytes} bytes`)
      }
    })
  const results = await Promise.all(feature.voices.flatMap((v) => feature.variants.map(async (s) => ({ what: `${v} ${JSON.stringify(s)}`, r: await one(v, s) }))))
  expect(results.filter((x) => x.r !== 'ok').map((x) => `${x.what} -> ${x.r}`)).toEqual([])
}

async function speakEveryVariant(feature: TtsFeature<unknown>) {
  if (feature.cutIn) return cutInEveryVariant(feature)
  if (feature.tokens) await tokensEveryVariant(feature)
  if (feature.session) await sessionEveryVariant(feature)
  const failed: string[] = []
  const jobs = feature.voices.flatMap((voice) => feature.variants.map((state) => ({ voice, state })))
  let next = 0
  const one = async ({ voice, state }: { voice: string; state: unknown }) => {
    const query = speakQuery(voice, feature.params(state))
    const url = `${speakPath(voice)}?${query}`
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(`https://api.deepgram.com${url}`, {
        method: 'POST',
        headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: feature.textFor?.(state) ?? feature.phrases[0] }),
      })
      const type = res.headers.get('content-type') ?? ''
      const bytes = (await res.arrayBuffer()).byteLength
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1500))
        continue
      }
      const want = feature.params(state).encoding === 'mulaw' ? 'mulaw' : 'audio/'
      if (res.status !== 200 || !type.includes(want) || bytes < 1000) failed.push(`${url} -> ${res.status} ${type} ${bytes} bytes`)
      // Inline controls in the text must be applied, not read aloud or dropped.
      const text = feature.textFor?.(state) ?? feature.phrases[0]
      const breaks = (text.match(/\\\{pause:|\{pause:\{/g) ?? []).length
      const prons = (text.match(/"pronounce"/g) ?? []).length
      if (breaks && Number(res.headers.get('dg-breaks-applied')) !== breaks) failed.push(`${url} -> dg-breaks-applied ${res.headers.get('dg-breaks-applied')}, want ${breaks}`)
      if (prons && Number(res.headers.get('dg-pronunciations-applied')) !== prons) failed.push(`${url} -> dg-pronunciations-applied ${res.headers.get('dg-pronunciations-applied')}, want ${prons}`)
      return
    }
    failed.push(`${url} -> 429 four times`)
  }
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (next < jobs.length) await one(jobs[next++])
  }))
  expect(failed).toEqual([])
}

// Voice agent: every variant with every listen model is sent as the first message, exactly as the
// page sends it, and must come back SettingsApplied with no Error.
async function settleEveryVariant(feature: AgentFeature<unknown>) {
  const one = (settings: unknown) =>
    new Promise<string>((resolve) => {
      const ws = new WebSocket(AGENT_URL, ['token', process.env.DEEPGRAM_API_KEY ?? ''])
      const timer = setTimeout(() => {
        ws.close()
        resolve('timed out')
      }, 15_000)
      ws.onopen = () => ws.send(JSON.stringify(settings))
      ws.onmessage = (e) => {
        if (typeof e.data !== 'string') return
        const m = JSON.parse(e.data)
        if (m.type === 'SettingsApplied' || m.type === 'Error') {
          clearTimeout(timer)
          ws.close()
          resolve(m.type === 'Error' ? `Error: ${m.description ?? m.message}` : 'ok')
        }
      }
      ws.onerror = () => {}
      ws.onclose = (e) => resolve(`closed ${e.code} ${e.reason}`)
    })
  const results = await Promise.all(
    feature.variants.flatMap((state) =>
      LISTEN_MODELS.map(async (m) => ({ what: `${m.id} ${JSON.stringify(state)}`, r: await one(settingsMessage(feature, state, m.id)) })),
    ),
  )
  expect(results.filter((x) => x.r !== 'ok').map((x) => `${x.what} -> ${x.r}`)).toEqual([])
}

// Mid-call buttons: each action is sent after SettingsApplied (with mic silence flowing, as on the
// page) and one of its ack messages must come back before any Error.
async function sendEveryAction(feature: AgentFeature<unknown>) {
  const one = (settings: unknown, action: AgentAction) =>
    new Promise<string>((resolve) => {
      const ws = new WebSocket(AGENT_URL, ['token', process.env.DEEPGRAM_API_KEY ?? ''])
      let silence: ReturnType<typeof setInterval> | undefined
      const end = (r: string) => {
        clearTimeout(timer)
        clearInterval(silence)
        ws.close()
        resolve(r)
      }
      const timer = setTimeout(() => end(`no ${action.ack.join(' or ')} in 15 s`), 15_000)
      let sent = false
      ws.onopen = () => ws.send(JSON.stringify(settings))
      ws.onmessage = (e) => {
        if (typeof e.data !== 'string') return
        const m = JSON.parse(e.data)
        if (m.type === 'Error') return end(`Error: ${m.description ?? m.message}`)
        if (m.type === 'SettingsApplied') {
          silence = setInterval(() => ws.readyState === 1 && ws.send(new Uint8Array(INPUT_RATE / 10 * 2)), 100)
          setTimeout(() => {
            sent = true
            ws.send(JSON.stringify(action.message))
          }, 1_500)
          return
        }
        if (sent && action.ack.includes(m.type)) end('ok')
      }
      ws.onerror = () => {}
      ws.onclose = (e) => end(`closed ${e.code} ${e.reason}`)
    })
  const results = await Promise.all(
    feature.variants.flatMap((state) =>
      LISTEN_MODELS.flatMap((m) =>
        (feature.actions?.(state) ?? []).map(async (a) => ({ what: `${m.id} ${a.label}`, r: await one(settingsMessage(feature, state, m.id), a) })),
      ),
    ),
  )
  expect(results.filter((x) => x.r !== 'ok').map((x) => `${x.what} -> ${x.r}`)).toEqual([])
}

describe.skipIf(!LIVE).each(names)('live: feature %s', (name) => {
  it('opens every request the page can make', async () => {
    expect(process.env.DEEPGRAM_API_KEY, 'DEEPGRAM_API_KEY missing from .env').toBeTruthy()
    const loaded = (await import(`../demos/${name}/index.tsx`)).default
    if (loaded.kind === 'tts') {
      await speakEveryVariant(loaded as TtsFeature<unknown>)
      return
    }
    if (loaded.kind === 'agent') {
      await settleEveryVariant(loaded as AgentFeature<unknown>)
      if ((loaded as AgentFeature<unknown>).actions) await sendEveryAction(loaded as AgentFeature<unknown>)
      return
    }
    const feature = loaded as Feature<unknown>
    const variants = feature.variants ?? [feature.initialState]
    const cases = feature.models.flatMap((model) =>
      feature.modes.flatMap((mode) => variants.map((state) => ({ model, params: feature.params(state, { model, mode, busy: false }) }))),
    )
    // The same request from two modes is only opened once.
    const unique = [...new Map(cases.map((c) => [`${c.model.endpoint}?${toQuery(requestParams(c.model, c.params))}`, c])).values()]
    const results = await Promise.all(unique.map(async (c) => ({ c, r: await probe(c.model, c.params) })))
    const failed = results
      .filter(({ r }) => !r.opened || ![1000, 1005].includes(r.code))
      .map(({ c, r }) => `${describeRequest(c.model, c.params)} -> opened=${r.opened} code=${r.code} ${r.reason}`)
    expect(failed).toEqual([])
  }, 180_000)

  it('links to docs that exist', async () => {
    const feature = (await import(`../demos/${name}/index.tsx`)).default as Feature<unknown>
    for (const href of [feature.links.docs, feature.links.changelog].filter(Boolean) as string[]) {
      const res = await fetch(href, { method: 'GET', redirect: 'follow' })
      expect(res.status, href).toBe(200)
    }
  }, 30_000)
})

// prompt.md: every URL and Settings message it shows is opened the way the prompt tells a reader to,
// with a token from /v1/auth/grant as a bearer subprotocol. An agent prompt with a function example
// also has the test phrase spoken to the agent (Aura-2 audio), and the call must come back.
async function grant(): Promise<string> {
  const res = await fetch('https://api.deepgram.com/v1/auth/grant', {
    method: 'POST',
    headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl_seconds: TOKEN_TTL_SECONDS }),
  })
  expect(res.status, 'grant').toBe(200)
  return (await res.json()).access_token
}

function openWithToken(url: string, token: string): Promise<Probe> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url, ['bearer', token])
    let opened = false
    const timer = setTimeout(() => (ws.close(), resolve({ opened, code: -1, reason: 'timed out' })), 15_000)
    ws.onopen = () => {
      opened = true
      ws.send(new ArrayBuffer(16_000))
      ws.send(JSON.stringify({ type: 'CloseStream' }))
    }
    ws.onerror = () => {}
    ws.onclose = (e) => (clearTimeout(timer), resolve({ opened, code: e.code, reason: e.reason }))
  })
}

// Streams audio at real time, sends ForceEndTurn, and returns the EndOfTurn transcript ('' if none).
function fluxStop(url: string, token: string, audio: ArrayBuffer): Promise<string> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url, ['bearer', token])
    let said = ''
    const timer = setTimeout(() => (ws.close(), resolve(said)), 30_000)
    ws.onopen = async () => {
      const bytes = new Uint8Array(audio)
      for (let i = 0; i < bytes.length; i += 3200) {
        ws.send(bytes.slice(i, i + 3200))
        await new Promise((r) => setTimeout(r, 100))
      }
      ws.send(JSON.stringify({ type: 'ForceEndTurn' }))
    }
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data))
      if (m.type === 'TurnInfo' && m.event === 'EndOfTurn') {
        said = `${said} ${m.transcript}`.trim()
        ws.send(JSON.stringify({ type: 'CloseStream' }))
      }
    }
    ws.onerror = () => {}
    ws.onclose = () => (clearTimeout(timer), resolve(said))
  })
}

async function speech(text: string): Promise<ArrayBuffer> {
  const q = new URLSearchParams({ model: 'aura-2-thalia-en', encoding: 'linear16', sample_rate: String(INPUT_RATE), container: 'none' })
  const res = await fetch(`https://api.deepgram.com/v1/speak?${q}`, {
    method: 'POST',
    headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  expect(res.status, 'speak').toBe(200)
  return res.arrayBuffer()
}

// Sends Settings, then the phrase as audio and two seconds of silence. Resolves with every event
// type seen and the first function call, answering it with the feature's own handler.
function converse(settings: unknown, token: string, audio: ArrayBuffer, answer?: (name: string, args: Record<string, unknown>) => unknown) {
  return new Promise<{ events: string[]; call?: { name: string; args: unknown }; error?: string }>((resolve) => {
    const ws = new WebSocket(AGENT_URL, ['bearer', token])
    const events: string[] = []
    let call: { name: string; args: unknown } | undefined
    const done = (error?: string) => (clearTimeout(timer), ws.close(), resolve({ events, call, error }))
    const timer = setTimeout(() => done('timed out'), 40_000)
    ws.onopen = () => ws.send(JSON.stringify(settings))
    ws.onmessage = async (e) => {
      if (typeof e.data !== 'string') return
      const m = JSON.parse(e.data)
      events.push(m.type)
      if (m.type === 'Error') return done(`Error: ${m.description ?? m.message}`)
      if (m.type === 'SettingsApplied') {
        if (!answer) return done()
        const step = (INPUT_RATE * 2) / 10
        const all = new Uint8Array(audio.byteLength + INPUT_RATE * 4)
        all.set(new Uint8Array(audio))
        for (let i = 0; i < all.length; i += step) {
          if (ws.readyState !== WebSocket.OPEN) return
          ws.send(all.slice(i, i + step))
          await new Promise((r) => setTimeout(r, 100))
        }
      }
      if (m.type === 'FunctionCallRequest' && answer) {
        for (const f of m.functions ?? []) {
          call = { name: f.name, args: JSON.parse(f.arguments || '{}') }
          ws.send(JSON.stringify({ type: 'FunctionCallResponse', id: f.id, name: f.name, content: JSON.stringify(answer(f.name, call.args as Record<string, unknown>)) }))
        }
      }
      if (call && m.type === 'ConversationText' && m.role === 'assistant') done()
    }
    ws.onerror = () => {}
    ws.onclose = (e) => (clearTimeout(timer), resolve({ events, call, error: `closed ${e.code} ${e.reason}` }))
  })
}

// A TTS prompt: each POST it shows comes back 200 with audio, and each socket runs the prompt's
// messages in order (Speak, Flush, then Interrupt, Speak, Flush once 2 s of audio is in) and must
// answer SpeechInterrupted with text_spoken, then the reply's audio. Warnings count as failures.
async function ttsPromptLive(md: string): Promise<string[]> {
  const { posts, sockets, listens } = ttsPromptRequests(md)
  const failed: string[] = []
  for (const url of listens) {
    const r = await openWithToken(url, await grant())
    if (!r.opened || ![1000, 1005].includes(r.code)) failed.push(`${url} -> opened=${r.opened} code=${r.code} ${r.reason}`)
  }
  for (const p of posts) {
    const res = await fetch(p.url, { method: 'POST', headers: { Authorization: `Bearer ${await grant()}`, 'Content-Type': 'application/json' }, body: p.body })
    const bytes = (await res.arrayBuffer()).byteLength
    if (res.status !== 200 || bytes < 1000) failed.push(`POST ${p.url} -> ${res.status} ${bytes} bytes`)
  }
  for (const s of sockets) {
    const token = await grant()
    const r = await new Promise<string>((resolve) => {
      const ws = new WebSocket(s.url, ['bearer', token])
      ws.binaryType = 'arraybuffer'
      // A prompt with Interrupt: Speak and Flush, then the cut once audio flows. Otherwise every
      // message in order (Configure, Speak, Flush): each Configure must be applied and the turn end.
      const interrupts = s.messages.some((m) => m.type === 'Interrupt')
      const wantConfigured = s.messages.filter((m) => m.type === 'Configure').length
      let configured = 0
      const [first, ...rest] = interrupts ? [s.messages.slice(0, 2), s.messages.slice(2)] : [s.messages, []]
      let bytes = 0
      let cut = false
      let spoken = false
      let reply = 0
      const end = (x: string) => (clearTimeout(timer), ws.close(), resolve(x))
      const timer = setTimeout(() => end(`timed out (bytes ${bytes}, cut ${cut}, spoken ${spoken})`), 30_000)
      ws.onopen = () => first.forEach((m) => ws.send(JSON.stringify(m)))
      ws.onerror = () => end('socket error')
      ws.onmessage = (e) => {
        if (typeof e.data !== 'string') {
          bytes += (e.data as ArrayBuffer).byteLength
          if (spoken) reply += (e.data as ArrayBuffer).byteLength
          if (!cut && bytes > 96_000) {
            cut = true
            rest[0].forEach((m) => ws.send(JSON.stringify(m)))
          }
          return
        }
        const m = JSON.parse(e.data)
        if (m.type === 'Error' || m.type === 'Warning' || m.type === 'ConfigureFailure') return end(`${m.type}: ${e.data.slice(0, 200)}`)
        if (m.type === 'ConfigureSuccess') configured++
        if (!interrupts && m.type === 'SpeechMetadata') return end(configured === wantConfigured && bytes > 1000 && m.speech_id ? 'ok' : `configured ${configured}/${wantConfigured}, ${bytes} bytes, speech_id ${m.speech_id}`)
        if (m.type === 'SpeechInterrupted') {
          if (typeof m.text_spoken !== 'string' || !m.text_spoken.trim()) return end(`no text_spoken: ${e.data.slice(0, 200)}`)
          spoken = true
        }
        if (m.type === 'SpeechMetadata' && spoken) end(reply > 1000 ? 'ok' : `reply had ${reply} bytes`)
      }
    })
    if (r !== 'ok') failed.push(`${s.url} -> ${r}`)
  }
  return failed
}

const withPrompt = names.filter((n) => existsSync(`demos/${n}/prompt.md`))
describe.skipIf(!LIVE || withPrompt.length === 0).each(withPrompt)('live: prompt.md for %s', (name) => {
  it('every request it shows works with a granted token', async () => {
    const md = readFileSync(`demos/${name}/prompt.md`, 'utf8')
    if ((await import(`../demos/${name}/index.tsx`)).default.kind === 'tts') {
      expect(await ttsPromptLive(md)).toEqual([])
      return
    }
    const { urls, settings } = promptRequests(md)
    const failed: string[] = []
    for (const url of urls) {
      const r = await openWithToken(url, await grant())
      if (!r.opened || ![1000, 1005].includes(r.code)) failed.push(`${url} -> opened=${r.opened} code=${r.code} ${r.reason}`)
    }
    const feature = (await import(`../demos/${name}/index.tsx`)).default
    // Flux: the phrase, then ForceEndTurn, must come back as an EndOfTurn with words in it, the way
    // the prompt says to stop.
    if (feature.kind !== 'agent' && feature.kind !== 'tts') {
      const mode = feature.modes[0]
      const state = (feature.variants ?? [feature.initialState]).at(-1)
      const audio = await speech(feature.phrases(state, { model: feature.models[0], mode, busy: false }).join(' '))
      for (const url of urls.filter((u) => u.includes('/v2/listen'))) {
        const said = await fluxStop(url, await grant(), audio)
        if (!said) failed.push(`${url} -> no EndOfTurn after ForceEndTurn`)
      }
    }
    for (const s of settings) {
      const ex = (feature as AgentFeature<unknown>).functionExample
      const audio = await speech(feature.phrases(feature.initialState).join(' '))
      const r = await converse(s, await grant(), audio, ex ? (n, a) => feature.onFunctionCall(n, a, feature.initialState) : undefined)
      if (ex) {
        if (r.error) failed.push(`Settings -> ${r.error} after ${r.events.join(',')}`)
        else expect(r.call).toEqual(ex)
      } else if (!r.events.includes('SettingsApplied')) failed.push(`Settings -> ${r.error}`)
    }
    expect(failed).toEqual([])
  }, 90_000)
})
