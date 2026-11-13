// Text-to-speech with a callback: Deepgram answers the POST at once with a request_id, makes the
// audio, and delivers it to a webhook. A browser cannot take a webhook, so the demo's own server
// does (demos/tts-callback/server.js, mounted at /demos/tts-callback/api/): the page asks it for a slot, passes the slot's URL as
// `callback`, and polls the slot until the audio is in.
import { fetchToken } from '../common/config'
import type { Params } from '../common/feature'
import { demoPath } from '../common/demo'
import { speakQuery, speakUrl } from './speak'

// The demo's own routes, from demos/<id>/server.js: /demos/<id>/api/callback.
const callbackPath = () => `${demoPath()}api/callback`

// What the Request card shows for `callback` until a run has a real slot.
export const CALLBACK_SHOWN = 'https://<this page>/demos/tts-callback/api/callback/<id>'
// priority=low reads the text from a URL, not the body. The card shows this until a run has one.
export const TEXT_URL_SHOWN = 'https://<this page>/demos/tts-callback/api/callback/<id>/text'

// How long the page waits for the webhook before it gives up. The server keeps a slot 10 minutes.
export const WAIT_MS = 5 * 60_000

export interface Slot {
  id: string
  callback: string
  textUrl: string
}

export interface Accepted {
  requestId: string
  // From sending the POST to Deepgram's answer. Token minting is not counted.
  acceptedMs: number
}

export interface Delivery {
  audio: ArrayBuffer
  contentType: string
  method: string
  // From the slot being made to the webhook landing on the server.
  afterMs: number
  // priority=low only: when Deepgram fetched the text, from the slot being made.
  textFetchedMs?: number
}

// A webhook URL on this machine: Deepgram cannot reach it, so nothing will ever arrive.
export const unreachable = (url: string) => /^https?:\/\/(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(url)

export const isLow = (params: Params) => params.priority === 'low'

// The body Deepgram gets: the text itself, or (priority=low) where to fetch it.
export const callbackBody = (params: Params, text: string, textUrl: string) => (isLow(params) ? { url: textUrl } : { text })

export async function openSlot(text: string): Promise<Slot> {
  let res: Response
  try {
    res = await fetch(callbackPath(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
  } catch {
    throw new Error('Could not reach the demo server. Check your connection and try again.')
  }
  if (res.status === 429) throw new Error('Too many lines from this address. Wait a minute and try again.')
  if (res.status === 503) throw new Error('Too many lines are waiting on a callback right now. Try again in a minute.')
  if (res.status === 404) throw new Error('This server has no callback receiver. It needs demos/tts-callback/server.js, which server.js mounts for this demo.')
  if (!res.ok) throw new Error('The demo could not set up a callback. Try again in a minute.')
  return res.json()
}

export async function requestCallback(model: string, params: Params, slot: Slot, text: string, signal: AbortSignal): Promise<Accepted> {
  const token = await fetchToken()
  const t0 = performance.now()
  let res: Response
  try {
    res = await fetch(`${speakUrl(model)}?${speakQuery(model, { ...params, callback: slot.callback })}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(callbackBody(params, text, slot.textUrl)),
      signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new Error('Could not reach Deepgram. Check your connection and try again.')
  }
  const acceptedMs = performance.now() - t0
  const body = await res.text().catch(() => '')
  if (!res.ok) throw new Error(`Deepgram did not take that request (${res.status}). ${body.slice(0, 160)}`.trim())
  let requestId = ''
  try {
    requestId = String(JSON.parse(body).request_id ?? '')
  } catch {
    // Not JSON: fall through to the check below.
  }
  if (!requestId) throw new Error('Deepgram answered without a request_id. Try again.')
  return { requestId, acceptedMs }
}

// Polls the slot once a second until the audio is in, the wait runs out, or the signal aborts.
export async function waitForAudio(id: string, signal: AbortSignal, onWait?: (textFetchedMs?: number) => void): Promise<Delivery> {
  const end = Date.now() + WAIT_MS
  while (Date.now() < end) {
    let res: Response
    try {
      res = await fetch(`${callbackPath()}/${id}`, { signal, cache: 'no-store' })
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err
      throw new Error('Lost the demo server while waiting for the audio. Check your connection and try again.')
    }
    if (res.status === 200) {
      const fetched = res.headers.get('x-text-fetched-ms')
      return {
        audio: await res.arrayBuffer(),
        contentType: res.headers.get('content-type') ?? '',
        method: res.headers.get('x-callback-method') ?? '',
        afterMs: Number(res.headers.get('x-callback-after-ms') ?? 0),
        textFetchedMs: fetched === null ? undefined : Number(fetched),
      }
    }
    if (res.status === 404) throw new Error('The callback expired before the audio came. Press Speak to try again.')
    if (res.status !== 202 && res.status !== 429) throw new Error('The demo server could not check on the audio. Try again in a minute.')
    if (res.status === 202) {
      const { textFetchedMs } = (await res.json().catch(() => ({}))) as { textFetchedMs?: number | null }
      onWait?.(textFetchedMs ?? undefined)
    }
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, 1000)
      signal.addEventListener('abort', () => (clearTimeout(t), reject(new DOMException('Stopped', 'AbortError'))), { once: true })
    })
  }
  throw new Error(`No audio after ${WAIT_MS / 60_000} minutes. Press Speak to try again.`)
}
