// Pre-recorded speech-to-text: one POST to /v1/listen with the whole clip, for the features the
// socket refuses (detect_language, paragraphs, diarize_model=v2 handshake with a 400). The browser
// sends it with the same 30-second granted token as the socket, as `Authorization: Bearer`.
// Checked live 2026-11-16: 200 with a granted token, and Deepgram answers CORS for any origin
// (allow-origin echoes the page, allow-headers include authorization and content-type).
import { fetchToken, requestParams, toQuery } from '../common/config'
import { demoPath } from '../common/demo'
import type { Json, Mode, Model, Params, Word } from '../common/feature'

export const LISTEN_REST = 'https://api.deepgram.com/v1/listen'

export interface BatchResult {
  json: Json
  // From sending the POST to the answer. Token minting is not counted.
  ms: number
}

export async function transcribe(model: Model, params: Params, mode: Mode, body: Blob, signal?: AbortSignal): Promise<BatchResult> {
  const token = await fetchToken()
  const t0 = performance.now()
  let res: Response
  try {
    res = await fetch(`${LISTEN_REST}?${toQuery(requestParams(model, params, mode))}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': body.type || 'application/octet-stream' },
      body,
      signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new Error('Could not reach Deepgram. Check your connection and try again.')
  }
  const ms = performance.now() - t0
  const text = await res.text().catch(() => '')
  let json: Json = {}
  try {
    json = JSON.parse(text)
  } catch {
    // Not JSON: the checks below say so.
  }
  if (!res.ok) {
    const why = typeof json.err_msg === 'string' ? ` ${json.err_msg}` : ''
    throw new Error(`Deepgram did not take that request (${res.status}).${why}`)
  }
  if (!json.results && !json.request_id) throw new Error('Deepgram answered with something that is not a transcript. Try again.')
  return { json, ms }
}

// Every word of a pre-recorded response, channel by channel. channel is set only when there is more
// than one (multichannel=true on stereo audio).
export function parseBatch(json: Json): Word[] {
  const channels = ((json.results as Json | undefined)?.channels as Json[] | undefined) ?? []
  return channels.flatMap((ch, c) => {
    const alt = (ch.alternatives as Json[] | undefined)?.[0]
    const fallback = ((alt?.languages as string[] | undefined) ?? [])[0] ?? String(ch.detected_language ?? '')
    return ((alt?.words as Json[] | undefined) ?? []).map((w) => ({
      text: String(w.punctuated_word ?? w.word ?? ''),
      lang: String(w.language ?? fallback),
      ...(typeof w.speaker === 'number' ? { speaker: w.speaker } : {}),
      ...(channels.length > 1 ? { channel: c } : {}),
    }))
  })
}

// ---- callback ------------------------------------------------------------------------------------
// With `callback`, Deepgram answers the POST at once with only a request_id and delivers the
// transcript to that URL later. A browser cannot take a webhook, so the demo's own server does:
// demos/<id>/server.js (mounted at /demos/<id>/api/) must provide, modeled on
// demos/tts-callback/server.js:
//   POST /callback        from the page, same-origin, rate limited -> { id, callback } where callback
//                         is `${kit.publicUrl(req)}/api/callback/${id}`
//   POST|PUT /callback/:id  Deepgram's delivery, JSON, size-capped, one per slot, 200
//   GET  /callback/:id    from the page: 202 while waiting, 200 with the JSON once it is in (then
//                         drop the slot), 404 for an unknown or expired id. Header
//                         x-callback-after-ms: slot made to delivery; x-callback-method: POST or PUT.
// Deepgram refuses a callback it cannot reach: a localhost URL is a 400 "Invalid callback URL"
// (checked 2026-11-16), so the page stops with a sentence instead of sending one. Locally, verify
// the request with pnpm verify:live (which asks for delivery to example.com) and the round trip
// only once deployed.

// What the Request card shows for `callback` until a run has a real slot.
export const CALLBACK_SHOWN = 'https://<this page>/api/callback/<id>'

export const unreachable = (url: string) => /^https?:\/\/(localhost|127\.|\[::1\]|0\.0\.0\.0|[^/]*\.localhost)/.test(url)

// How long the page waits for the delivery. Pre-recorded jobs this short take seconds.
export const CALLBACK_WAIT_MS = 2 * 60_000

const callbackPath = () => `${demoPath()}api/callback`

export async function openCallbackSlot(): Promise<{ id: string; callback: string }> {
  let res: Response
  try {
    res = await fetch(callbackPath(), { method: 'POST' })
  } catch {
    throw new Error('Could not reach the demo server. Check your connection and try again.')
  }
  if (res.status === 429) throw new Error('Too many runs from this address. Wait a minute and try again.')
  if (res.status === 404) throw new Error('This server has no callback receiver. The demo needs a server.js with the callback routes.')
  if (!res.ok) throw new Error('The demo could not set up a callback. Try again in a minute.')
  return res.json()
}

export interface Delivery {
  json: Json
  afterMs: number
  method: string
}

// Polls the slot once a second until the transcript is in, the wait runs out, or the signal aborts.
export async function waitForCallback(id: string, signal?: AbortSignal): Promise<Delivery> {
  const end = Date.now() + CALLBACK_WAIT_MS
  while (Date.now() < end) {
    let res: Response
    try {
      res = await fetch(`${callbackPath()}/${id}`, { signal, cache: 'no-store' })
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err
      throw new Error('Lost the demo server while waiting for the transcript. Check your connection and try again.')
    }
    if (res.status === 200) {
      return {
        json: await res.json(),
        afterMs: Number(res.headers.get('x-callback-after-ms') ?? 0),
        method: res.headers.get('x-callback-method') ?? '',
      }
    }
    if (res.status === 404) throw new Error('The callback expired before the transcript came. Run it again.')
    if (res.status !== 202 && res.status !== 429) throw new Error('The demo server could not check on the transcript. Try again in a minute.')
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, 1000)
      signal?.addEventListener('abort', () => (clearTimeout(t), reject(new DOMException('Stopped', 'AbortError'))), { once: true })
    })
  }
  throw new Error(`No transcript after ${CALLBACK_WAIT_MS / 60_000} minutes. Run it again.`)
}
