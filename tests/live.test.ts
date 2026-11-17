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
import { PROMPT_CALLBACK, PROMPT_TEXT_URL, ttsPromptRequests } from '../shared/tts/prompt'
import { CALLBACK_SHOWN, callbackBody } from '../shared/tts/callback'
import { LISTEN_URL } from '../shared/tts/listen'
import { pieces, sessionUrl } from '../shared/tts/session'
import { tokenize, tokenUrl } from '../shared/tts/tokens'
import { CLOSE_MESSAGE, closeMidLine } from '../shared/tts/close'

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
import { AGENT_URL, INPUT_RATE, listenIdsOf, settingsMessage, type AgentAction, type AgentAudio, type AgentFeature } from '../shared/agent/feature'
import { encodeMic } from '../shared/agent/codec'
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
// turn must end in SpeechMetadata with a new speech_id, audio and billable characters. With close,
// Close goes after the last turn and SessionMetadata must report the sum of every turn.
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
      const sum = { audio: 0, billed: 0 }
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
          sum.audio += m.audio_duration_ms
          sum.billed += m.billable_character_count
          if (++i < feature.variants.length) return turn()
          if (!feature.close) return end('ok')
          ws.send(JSON.stringify(CLOSE_MESSAGE))
        }
        if (m.type === 'SessionMetadata') {
          const same = m.total_audio_duration_ms === sum.audio && m.total_billable_character_count === sum.billed
          end(same ? 'ok' : `SessionMetadata ${e.data.slice(0, 200)} vs turns ${JSON.stringify(sum)}`)
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

// Close mode: every voice and variant as the page sends it, Speak then the close afterMs later.
// Close must bring the rest of the line after it and end in a 1000 from Deepgram, with no Error or
// Warning; on Flux, SessionMetadata must come first. A dropped socket must have opened and taken audio.
async function closeEveryVariant(feature: TtsFeature<unknown>) {
  const close = closeMidLine(feature)!
  const one = (voice: string, state: unknown) =>
    new Promise<string>((resolve) => {
      const graceful = close.graceful(state)
      const ws = new WebSocket(socketUrl(voice, feature.params(state)), ['token', process.env.DEEPGRAM_API_KEY ?? ''])
      ws.binaryType = 'arraybuffer'
      let bytes = 0
      let after = 0
      let sent = false
      let session = false
      let bad = ''
      const end = (r: string) => (clearTimeout(timer), resolve(r))
      const timer = setTimeout(() => (ws.close(), end(`timed out (bytes ${bytes}, after ${after})`)), 30_000)
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'Speak', text: feature.phrases[0] }))
        setTimeout(() => {
          sent = true
          if (graceful) return ws.send(JSON.stringify(CLOSE_MESSAGE))
          ws.close()
          end(bytes > 0 && !bad ? 'ok' : bad || 'no audio before the drop')
        }, close.afterMs)
      }
      ws.onerror = () => {}
      ws.onmessage = (e) => {
        if (typeof e.data !== 'string') {
          bytes += (e.data as ArrayBuffer).byteLength
          if (sent) after += (e.data as ArrayBuffer).byteLength
          return
        }
        const m = JSON.parse(e.data)
        if (m.type === 'Error' || m.type === 'Warning') bad = `${m.type}: ${e.data.slice(0, 200)}`
        if (m.type === 'SessionMetadata') session = true
      }
      ws.onclose = (e) => {
        if (!graceful) return
        if (bad) return end(bad)
        if (e.code !== 1000) return end(`closed ${e.code} ${e.reason}`)
        if (after < 48_000) return end(`only ${after} bytes after Close`)
        if (voice.startsWith('flux-') && !session) return end('no SessionMetadata before the close')
        end('ok')
      }
    })
  const results = await Promise.all(feature.voices.flatMap((v) => feature.variants.map(async (s) => ({ what: `${v} ${JSON.stringify(s)}`, r: await one(v, s) }))))
  expect(results.filter((x) => x.r !== 'ok').map((x) => `${x.what} -> ${x.r}`)).toEqual([])
}

// Where a callback check asks Deepgram to deliver. Reserved for examples (RFC 2606), so nothing real
// gets the audio; the check is that Deepgram takes the request and answers with a request_id.
const CHECK_CALLBACK = 'https://example.com/tts-callback'
const CHECK_TEXT_URL = 'https://example.com/tts-callback.txt'

// Callback mode: every voice and variant is accepted, 200 with a request_id and no audio. A
// Flux-only variant is sent with Flux voices only, as the page does.
async function callbackEveryVariant(feature: TtsFeature<unknown>) {
  const failed: string[] = []
  const jobs = feature.variants.flatMap((state) =>
    feature.voices.filter((v) => !feature.callback?.fluxOnly?.(state) || v.startsWith('flux-')).map((voice) => ({ voice, state })),
  )
  for (const { voice, state } of jobs) {
    const params = feature.params(state)
    expect(params.callback).toBe(CALLBACK_SHOWN)
    const url = `${speakPath(voice)}?${speakQuery(voice, { ...params, callback: CHECK_CALLBACK })}`
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(`https://api.deepgram.com${url}`, {
        method: 'POST',
        headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(callbackBody(params, feature.phrases[0], CHECK_TEXT_URL)),
      })
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1500))
        continue
      }
      const body = await res.text()
      if (res.status !== 200 || !/"request_id"/.test(body)) failed.push(`${url} -> ${res.status} ${body.slice(0, 160)}`)
      break
    }
  }
  expect(failed).toEqual([])
}

async function speakEveryVariant(feature: TtsFeature<unknown>) {
  if (feature.callback) return callbackEveryVariant(feature)
  if (feature.cutIn) return cutInEveryVariant(feature)
  if (closeMidLine(feature)) return closeEveryVariant(feature)
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
// page sends it, and must come back SettingsApplied with no Error. A variant with expects.error must
// come back that Error code instead; one with expects.warning must also get that Warning code.
async function settleEveryVariant(feature: AgentFeature<unknown>) {
  const one = (settings: unknown, expects: { error?: string; warning?: string } = {}) =>
    new Promise<string>((resolve) => {
      const ws = new WebSocket(AGENT_URL, ['token', process.env.DEEPGRAM_API_KEY ?? ''])
      let applied = false
      const warnings: string[] = []
      const end = (r: string) => {
        clearTimeout(timer)
        ws.close()
        resolve(r)
      }
      const timer = setTimeout(() => end(applied ? `no Warning ${expects.warning} in 5 s, got ${warnings.join(',') || 'none'}` : 'timed out'), 15_000)
      ws.onopen = () => ws.send(JSON.stringify(settings))
      ws.onmessage = (e) => {
        if (typeof e.data !== 'string') return
        const m = JSON.parse(e.data)
        if (m.type === 'Warning') warnings.push(m.code)
        if (m.type === 'Error') return end(expects.error && m.code === expects.error ? 'ok' : `Error: ${m.code} ${m.description ?? m.message}`)
        if (m.type === 'SettingsApplied') {
          if (expects.error) return end(`SettingsApplied, expected Error ${expects.error}`)
          applied = true
          if (!expects.warning) return end('ok')
          clearTimeout(timer)
          setTimeout(() => end(`no Warning ${expects.warning} in 5 s, got ${warnings.join(',') || 'none'}`), 5_000)
        }
        if (applied && expects.warning && warnings.includes(expects.warning)) end('ok')
      }
      ws.onerror = () => {}
      ws.onclose = (e) => resolve(`closed ${e.code} ${e.reason}`)
    })
  const results = await Promise.all(
    feature.variants.flatMap((state) =>
      listenIdsOf(feature).map(async (id) => ({ what: `${id || 'own listen'} ${JSON.stringify(state)}`, r: await one(settingsMessage(feature, state, id), feature.expects?.(state)) })),
    ),
  )
  expect(results.filter((x) => x.r !== 'ok').map((x) => `${x.what} -> ${x.r}`)).toEqual([])
}

// Mid-call buttons: each action is sent after SettingsApplied (with mic silence flowing, as on the
// page) and one of its ack messages must come back before any Error. An action with ack [] expects
// nothing back: no Error or Warning within 3 s is a pass. mic: 'off' stops the silence, as the page
// stops the mic.
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
      const silent = action.ack.length === 0
      ws.onopen = () => ws.send(JSON.stringify(settings))
      ws.onmessage = (e) => {
        if (typeof e.data !== 'string') return
        const m = JSON.parse(e.data)
        if (m.type === 'Error') return end(`Error: ${m.description ?? m.message}`)
        if (sent && silent && m.type === 'Warning') return end(`Warning: ${m.code} ${m.description}`)
        if (m.type === 'SettingsApplied') {
          silence = setInterval(() => ws.readyState === 1 && ws.send(new Uint8Array(INPUT_RATE / 10 * 2)), 100)
          setTimeout(() => {
            sent = true
            ws.send(JSON.stringify(action.message))
            if (action.mic === 'off') clearInterval(silence)
            if (silent) setTimeout(() => end('ok'), 3_000)
          }, 1_500)
          return
        }
        if (sent && action.ack.includes(m.type)) end('ok')
      }
      ws.onerror = () => {}
      ws.onclose = (e) => end(`closed ${e.code} ${e.reason}`)
    })
  const results = await Promise.all(
    feature.variants
      .filter((state) => !feature.expects?.(state)?.error)
      .flatMap((state) =>
        listenIdsOf(feature).flatMap((id) =>
          (feature.actions?.(state) ?? []).map(async (a) => ({ what: `${id || 'own listen'} ${a.label}`, r: await one(settingsMessage(feature, state, id), a) })),
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
    // Batch modes are POSTs, checked below; the socket checks cover the streaming modes.
    if (feature.modes.some((m) => m.batch)) expect(await batchEveryVariant(feature)).toEqual([])
    if (feature.actions) expect(await sttActionsEveryVariant(feature)).toEqual([])
    const cases = feature.models.flatMap((model) =>
      feature.modes.filter((mode) => !mode.batch).flatMap((mode) => variants.map((state) => ({ model, params: feature.params(state, { model, mode, busy: false }) }))),
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
        // 16 kHz linear16 speech plus 2 s of silence, encoded to whatever audio.input the Settings names.
        const pcm = new Uint8Array(audio.byteLength + INPUT_RATE * 4)
        pcm.set(new Uint8Array(audio))
        const input = (settings as { audio?: { input?: AgentAudio['input'] } }).audio?.input
        const all = new Uint8Array(input ? encodeMic(pcm.buffer, input) : pcm.buffer)
        const step = Math.round(all.length / (pcm.length / ((INPUT_RATE * 2) / 10)))
        for (let i = 0; i < all.length; i += step) {
          if (ws.readyState !== WebSocket.OPEN) return
          ws.send(all.slice(i, i + step))
          await new Promise((r) => setTimeout(r, 100))
        }
      }
      if (m.type === 'FunctionCallRequest' && answer) {
        for (const f of m.functions ?? []) {
          call = { name: f.name, args: JSON.parse(f.arguments || '{}') }
          // A function with an endpoint is answered by that server, not by the page.
          if (f.client_side === false) continue
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
// messages in order (Speak, Flush, then Interrupt or Clear, Speak, Flush once 2 s of audio is in) and
// must answer SpeechInterrupted with text_spoken (Flux) or Cleared (Aura-2), then the reply's audio.
// Warnings count as failures.
async function ttsPromptLive(md: string): Promise<string[]> {
  const { posts, sockets, listens } = ttsPromptRequests(md)
  const failed: string[] = []
  for (const url of listens) {
    const r = await openWithToken(url, await grant())
    if (!r.opened || ![1000, 1005].includes(r.code)) failed.push(`${url} -> opened=${r.opened} code=${r.code} ${r.reason}`)
  }
  for (const p of posts) {
    // A callback request answers with a request_id, not audio. Its example webhook is swapped for
    // one Deepgram can reach.
    const shown = encodeURIComponent(PROMPT_CALLBACK).replace(/%20/g, '+')
    const callback = p.url.includes(shown)
    const url = callback ? p.url.replace(shown, encodeURIComponent(CHECK_CALLBACK)) : p.url
    const body = callback ? p.body.replace(PROMPT_TEXT_URL, CHECK_TEXT_URL) : p.body
    const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${await grant()}`, 'Content-Type': 'application/json' }, body })
    const got = await res.arrayBuffer()
    if (callback) {
      const text = new TextDecoder().decode(got)
      if (res.status !== 200 || !/"request_id"/.test(text)) failed.push(`POST ${url} -> ${res.status} ${text.slice(0, 160)}`)
    } else if (res.status !== 200 || got.byteLength < 1000) failed.push(`POST ${p.url} -> ${res.status} ${got.byteLength} bytes`)
  }
  for (const s of sockets) {
    const token = await grant()
    const r = await new Promise<string>((resolve) => {
      const ws = new WebSocket(s.url, ['bearer', token])
      ws.binaryType = 'arraybuffer'
      // A prompt with Interrupt: Speak and Flush, then the cut once audio flows. Otherwise every
      // message in order (Configure, Speak, Flush): each Configure must be applied and the turn end.
      const interrupts = s.messages.some((m) => m.type === 'Interrupt' || m.type === 'Clear')
      // A prompt with Close: every message in order, then the rest of the audio and a 1000 from
      // Deepgram. On Flux (/v2/speak), SessionMetadata must come first, its billable total the sum of
      // the turns' SpeechMetadata.
      const closes = s.messages.some((m) => m.type === 'Close')
      const flux = s.url.includes('/v2/speak')
      let billed = 0
      let totals = ''
      ws.onclose = (e) => {
        if (!closes) return
        if (e.code !== 1000 || bytes <= 48_000) return end(`closed ${e.code} with ${bytes} bytes`)
        if (flux && totals !== 'ok') return end(totals || 'no SessionMetadata before the close')
        end('ok')
      }
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
        if (closes) {
          if (m.type === 'SpeechMetadata') billed += m.billable_character_count
          if (m.type === 'SessionMetadata') totals = m.total_billable_character_count === billed && billed > 0 ? 'ok' : `SessionMetadata ${e.data.slice(0, 200)}, turns billed ${billed}`
          return
        }
        if (!interrupts && m.type === 'SpeechMetadata') return end(configured === wantConfigured && bytes > 1000 && m.speech_id ? 'ok' : `configured ${configured}/${wantConfigured}, ${bytes} bytes, speech_id ${m.speech_id}`)
        if (m.type === 'SpeechInterrupted') {
          if (typeof m.text_spoken !== 'string' || !m.text_spoken.trim()) return end(`no text_spoken: ${e.data.slice(0, 200)}`)
          spoken = true
        }
        if (m.type === 'Cleared') spoken = true
        const replyDone = m.type === 'SpeechMetadata' || (m.type === 'Flushed' && Number(m.sequence_id) > 0)
        if (replyDone && spoken) end(reply > 1000 ? 'ok' : `reply had ${reply} bytes`)
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
    const { urls, settings, listenPosts } = promptRequests(md)
    const failed: string[] = []
    // Pre-recorded: the POST it shows, with a granted token as Bearer and the phrase as WAV.
    for (const url of listenPosts) {
      const feature = (await import(`../demos/${name}/index.tsx`)).default as Feature<unknown>
      const mode = feature.modes[0]
      const body = await batchBody(feature, mode, feature.promptState ?? (feature.variants ?? [feature.initialState]).at(-1))
      const r = await postListen(url.replace(/callback=[^&]*/, `callback=${encodeURIComponent(CHECK_STT_CALLBACK)}`), body, `Bearer ${await grant()}`)
      if (r) failed.push(`POST ${url} -> ${r}`)
    }
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

// The optional agent hooks (2026-11-16), checked live on a stand-in feature so they stay covered
// before any demo uses them: listen provider fields, top-level Settings fields, phone audio, a
// stored agent config id, an expected Error and Warning, and mid-call messages with nothing to ack
// (KeepAlive with the mic off), plus UpdateListen, UpdateThink, UpdateThink_Live, InjectUserMessage
// and a dynamic InjectAgentMessage. Runs with no ONLY, or ONLY=agent-hooks.
describe.skipIf(!LIVE || (only && !only.includes('agent-hooks')))('live: agent shell hooks', () => {
  type H = { v: 'keyterms' | 'phone' | 'stored' | 'think-fast' | 'bad' }
  const think = { provider: { type: 'open_ai', model: 'gpt-4o-mini' }, prompt: 'You are terse.' }
  const speak = { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } }
  const thinkLive = { provider: { type: 'deepgram', version: 'v1', presence_check_max_count: 0 } }
  // The one agent config stored in the demo key's project (GET /v1/projects/{id}/agents, 2026-11-16).
  const STORED = '377c136a-5516-4824-8f54-0220d5ce2920'
  const feature: AgentFeature<H> = {
    kind: 'agent',
    copy: { headline: '', lede: '', ctaTitle: '', ctaBody: '' },
    links: { docs: '' },
    initialState: { v: 'keyterms' },
    variants: [{ v: 'keyterms' }, { v: 'phone' }, { v: 'think-fast' }, { v: 'bad' }],
    listenModels: [{ id: 'flux-general-en', label: 'Flux' }],
    listen: () => ({ version: 'v2', keyterms: ['Deepgram'], eot_threshold: 0.8, eager_eot_threshold: 0.5, eot_timeout_ms: 3000 }),
    settings: () => ({ tags: ['devrel-demos-check'], flags: { history: false } }),
    audio: ({ v }) => (v === 'phone' ? { input: { encoding: 'mulaw', sample_rate: 8000 }, output: { encoding: 'mulaw', sample_rate: 8000, container: 'none' } } : { input: { encoding: 'linear16', sample_rate: 16000 }, output: { encoding: 'linear16', sample_rate: 24000, container: 'none' } }),
    agent: ({ v }) =>
      v === 'stored'
        ? STORED
        : {
            think: v === 'think-fast' ? { provider: { type: 'deepgram', model: 'think-fast' }, prompt: 'You are terse.' } : think,
            speak: v === 'bad' ? { provider: { type: 'deepgram', model: 'aura-2-thalia-en', language: 'en' } } : speak,
            think_live: thinkLive,
          },
    expects: ({ v }) => (v === 'think-fast' ? { warning: 'VOICE_PROMPT_ADDED' } : v === 'bad' ? { error: 'UNPARSABLE_CLIENT_MESSAGE' } : {}),
    actions: () => [
      { label: 'mute', message: { type: 'KeepAlive' }, ack: [], mic: 'off', repeatMs: 8000 },
      { label: 'listen', message: { type: 'UpdateListen', listen: { provider: { type: 'deepgram', version: 'v2', model: 'flux-general-en', keyterms: ['Aura'] } } }, ack: ['ListenUpdated'] },
      { label: 'think', message: { type: 'UpdateThink', think }, ack: ['ThinkUpdated'] },
      { label: 'think live', message: { type: 'UpdateThink_Live', think_live: thinkLive }, ack: ['ThinkLiveUpdated'] },
      { label: 'type', message: { type: 'InjectUserMessage', content: 'Say hi.' }, ack: ['ConversationText'], hidden: true },
      // With nothing said yet the filler is often not worded: DYNAMIC_FILLER_UNAVAILABLE (2 of 3 in a
      // probe, 2026-11-16). Either answer means the message was understood.
      { label: 'filler', message: { type: 'InjectAgentMessage', behavior: 'default', is_dynamic: true }, ack: ['ConversationText', 'Warning'] },
    ],
    highlight: [],
    events: [],
    flushOnUserSpeech: () => true,
    runLabel: () => '',
    phrases: () => [],
    Controls: () => null,
  }

  it('applies every Settings shape and acks every mid-call message', async () => {
    expect(process.env.DEEPGRAM_API_KEY, 'DEEPGRAM_API_KEY missing from .env').toBeTruthy()
    await settleEveryVariant(feature as AgentFeature<unknown>)
    await sendEveryAction({ ...feature, variants: [{ v: 'keyterms' }] } as AgentFeature<unknown>)
    // A stored config carries its own listen: no listen block, no toggle.
    await settleEveryVariant({ ...feature, listenModels: [], variants: [{ v: 'stored' }] } as AgentFeature<unknown>)
  }, 120_000)
})

// ---- Speech-to-text extensions (2026-11-16) -------------------------------------------------------
import path from 'node:path'
import { wav, transcode, declaredFormat } from '../shared/stt/audio'
import { eventName, matches } from '../shared/stt/events'
import type { Mode, SttAction } from '../shared/common/feature'

// Where a callback check asks Deepgram to deliver. Reserved for examples (RFC 2606): the check is that
// Deepgram takes the request and answers with a request_id.
const CHECK_STT_CALLBACK = 'https://example.com/stt-callback'

// The clip a batch mode sends: its bundled sample, or the phrase spoken by Aura-2 as WAV.
async function batchBody(feature: Feature<unknown>, mode: Mode, state: unknown): Promise<Blob> {
  if (mode.sample) {
    const file = mode.sample.url.startsWith('/') ? path.join(process.cwd(), mode.sample.url) : mode.sample.url
    const ext = path.extname(file).slice(1).toLowerCase()
    return new Blob([readFileSync(file)], { type: ext === 'wav' ? 'audio/wav' : ext === 'mp3' ? 'audio/mpeg' : `audio/${ext}` })
  }
  const phrase = feature.phrases?.(state, { model: feature.models[0], mode, busy: false }).join(' ') || 'Testing one two three.'
  return wav([await speech(phrase)])
}

// '' when Deepgram answers 200 with a transcript (or, with a callback, a request_id).
async function postListen(url: string, body: Blob, auth: string): Promise<string> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { method: 'POST', headers: { Authorization: auth, 'Content-Type': body.type }, body })
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500))
      continue
    }
    const text = await res.text()
    if (res.status !== 200) return `${res.status} ${text.slice(0, 160)}`
    return /"results"|"request_id"/.test(text) ? '' : `200 without results: ${text.slice(0, 120)}`
  }
  return 'rate limited'
}

async function batchEveryVariant(feature: Feature<unknown>): Promise<string[]> {
  const failed: string[] = []
  const seen = new Set<string>()
  for (const mode of feature.modes.filter((m) => m.batch)) {
    for (const model of feature.models) {
      if (model.endpoint !== 'v1') failed.push(`${mode.id}: batch modes need a v1 model, not ${model.id}`)
      for (const state of feature.variants ?? [feature.initialState]) {
        let params = feature.params(state, { model, mode, busy: false })
        if (feature.callback) params = { ...params, callback: CHECK_STT_CALLBACK }
        const url = `https://api.deepgram.com/v1/listen?${toQuery(requestParams(model, params, mode))}`
        if (seen.has(`${mode.sample?.url}${url}`)) continue
        seen.add(`${mode.sample?.url}${url}`)
        const r = await postListen(url, await batchBody(feature, mode, state), `Token ${process.env.DEEPGRAM_API_KEY}`)
        if (r) failed.push(`${describeRequest(model, params, mode)} -> ${r}`)
      }
    }
  }
  return failed
}

// One action, live: stream up to 3 s of the phrase in real time (in the feature's audio format),
// pause the audio if the action does, send the message, and wait for an ack. With no ack, the socket
// must stay open with no Error (12 s for a repeating KeepAlive, past the 10 s timeout). With ends,
// it must close cleanly, after the ack if one is named.
function sttAction(url: string, audio: ArrayBuffer, per: number, a: SttAction): Promise<string> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url, ['token', process.env.DEEPGRAM_API_KEY ?? ''])
    let acked = !a.ack?.length
    let sent = false
    let done = false
    let repeat: ReturnType<typeof setInterval> | undefined
    const end = (r: string) => {
      if (done) return
      done = true
      clearTimeout(timer)
      clearInterval(repeat)
      ws.close()
      resolve(r)
    }
    const hold = a.every ? 12_000 : 1_500
    const timer = setTimeout(() => end(a.ack?.length && !acked ? `no ${a.ack.join(' or ')} in time` : a.ends ? 'did not close' : 'ok'), 8_000 + hold)
    ws.onopen = async () => {
      const bytes = new Uint8Array(audio)
      for (let i = 0; i < Math.min(bytes.length, per * 30) && !done; i += per) {
        ws.send(bytes.slice(i, i + per))
        await new Promise((r) => setTimeout(r, 100))
      }
      if (done || !a.message) return end('ok')
      sent = true
      ws.send(JSON.stringify(a.message))
      if (a.every) repeat = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify(a.message)), a.every)
      if (!a.ack?.length && !a.ends) setTimeout(() => end('ok'), hold)
    }
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data))
      const name = eventName(m)
      if (name === 'Error') return end(`Error: ${m.description ?? m.message}`)
      if (sent && a.ack && matches(name, a.ack)) {
        acked = true
        if (!a.ends) end('ok')
      }
    }
    ws.onerror = () => {}
    ws.onclose = (e) => {
      if (a.ends && sent && [1000, 1005].includes(e.code)) return end(acked ? 'ok' : `closed before ${a.ack?.join(' or ')}`)
      end(`closed ${e.code} ${e.reason}`)
    }
  })
}

async function sttActionsEveryVariant(feature: Feature<unknown>): Promise<string[]> {
  const failed: string[] = []
  const mode = feature.modes.find((m) => !m.batch)
  if (!mode) return failed
  for (const model of feature.models) {
    for (const state of feature.variants ?? [feature.initialState]) {
      const ctx = { model, mode, busy: false }
      const params = feature.params(state, ctx)
      const sent = requestParams(model, params)
      const pcm = await speech(feature.phrases?.(state, ctx).join(' ') || 'Testing one two three.')
      const format = feature.audio?.(state, ctx) ?? declaredFormat(sent)
      const audio = transcode(pcm, format)
      // 100 ms of that format.
      const per = (format.sample_rate / 10) * (format.encoding === 'linear16' ? 2 : 1)
      const url = `wss://api.deepgram.com/${model.endpoint}/listen?${toQuery(sent)}`
      for (const a of feature.actions?.(state, ctx) ?? []) {
        if (!a.message) continue
        const r = await sttAction(url, audio, per, a)
        if (r !== 'ok') failed.push(`${describeRequest(model, params)} ${a.label} -> ${r}`)
      }
    }
  }
  return failed
}
