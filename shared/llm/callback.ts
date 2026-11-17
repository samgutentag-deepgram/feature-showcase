// /v1/read with a callback: Deepgram answers the POST at once with a request_id, analyzes the
// text, and POSTs (or PUTs, callback_method=put) the result to a webhook. A browser cannot take a
// webhook, so the demo's own server does. The demo adds demos/<id>/server.js (start from
// demos/tts-callback/server.js) with two routes, mounted at /demos/<id>/api/:
//
//   POST /callback        same-origin only, rate limited. Answers {"id", "callback"}: a slot that
//                         takes one delivery and lives 10 minutes. `callback` is its public URL.
//   POST|PUT /callback/:id  Deepgram's delivery, JSON, size-capped. Answer 200.
//   GET  /callback/:id    same-origin only. 202 {"waiting": true} until the delivery lands, then
//                         200 {"body": <the JSON Deepgram sent>, "method": "POST"|"PUT",
//                         "afterMs": <slot made to delivery>} once, and the slot is dropped.
//
// Deepgram cannot reach localhost: run with PUBLIC_URL set to a tunnel to test it locally.
// Callback URLs may use ports 80, 443, 8080 and 8443 only (docs, text-intelligence-callback).
import type { Json } from '../common/feature'
import { demoPath } from '../common/demo'

const callbackPath = () => `${demoPath()}api/callback`

// What the Request card shows for `callback` until a run has a real slot.
export const callbackShown = () => `https://<this page>${demoPath()}api/callback/<id>`

// How long the page waits for the delivery before it gives up.
export const WAIT_MS = 2 * 60_000

export interface Slot {
  id: string
  callback: string
}

export interface Delivery {
  body: Json
  method: string
  afterMs: number
}

export const unreachable = (url: string) => /^https?:\/\/(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(url)

export async function openSlot(): Promise<Slot> {
  let res: Response
  try {
    res = await fetch(callbackPath(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  } catch {
    throw new Error('Could not reach the demo server. Check your connection and try again.')
  }
  if (res.status === 429) throw new Error('Too many requests from this address. Wait a minute and try again.')
  if (res.status === 503) throw new Error('Too many results are waiting on a callback right now. Try again in a minute.')
  if (res.status === 404) throw new Error('This server has no callback receiver. The demo needs its own server.js.')
  if (!res.ok) throw new Error('The demo server could not make a callback slot. Try again in a minute.')
  return (await res.json()) as Slot
}

// Polls the slot once a second until the delivery lands, WAIT_MS passes, or stop() is called.
export async function waitForDelivery(id: string, stopped: () => boolean = () => false): Promise<Delivery> {
  const until = Date.now() + WAIT_MS
  while (Date.now() < until && !stopped()) {
    const res = await fetch(`${callbackPath()}/${encodeURIComponent(id)}`).catch(() => null)
    if (res?.status === 200) return (await res.json()) as Delivery
    if (res && res.status !== 202) throw new Error('The callback slot expired before Deepgram delivered. Try again.')
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('Deepgram has not delivered yet. It retries a failed delivery every 30 seconds, so check that this server is reachable from the internet.')
}
