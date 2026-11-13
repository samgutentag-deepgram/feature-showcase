// Shell settings and the one place a request is assembled. The Request card and the socket both
// build from requestParams, so the card can never show a param the socket does not send.
import type { Model, Params } from './feature'

// Audio the browser sends: 16 kHz mono 16-bit PCM, for mic and uploads alike.
export const SAMPLE_RATE = 16_000

// Safeguards for the hosted demo. Uploads over either limit are refused with a dialog, and a mic
// run stops itself at MAX_SECONDS. 1 MB holds a minute of 128 kbps MP3.
// Running it yourself? Raise these here.
export const MAX_SECONDS = 60
export const MAX_UPLOAD_BYTES = 1024 * 1024

// Short-lived token from server.js. Called fresh for every session.
export async function fetchToken(): Promise<string> {
  let res: Response
  try {
    res = await fetch('/api/token')
  } catch {
    throw new Error('Could not reach the demo server. Check your connection and try again.')
  }
  if (res.status === 429) throw new Error('Too many sessions from this address. Wait a minute and try again.')
  if (res.status === 403) throw new Error('This page has to be opened from its own address to start a session.')
  if (!res.ok) throw new Error('The demo could not start a session right now. Try again in a minute.')
  return res.text()
}

// The only params a page may send without showing: how the audio is framed and streamed. Nothing
// here changes the words in a final transcript.
export const PLUMBING = ['encoding', 'sample_rate', 'interim_results']

// What the Request card shows: the model's params, then the feature's.
export function shownParams(model: Model, feature: Params): Params {
  return { ...model.params, ...feature }
}

// Everything a session puts on the query string. Raw PCM has no header, so Deepgram needs the
// encoding and rate spelled out. Nova (v1) also streams interim results for the live view.
export function requestParams(model: Model, feature: Params): Params {
  return {
    ...shownParams(model, feature),
    // Unless the feature sets it itself (the interim-results demo does).
    ...(model.endpoint === 'v1' && !('interim_results' in feature) ? { interim_results: 'true' } : {}),
    ...model.hidden,
    encoding: 'linear16',
    sample_rate: String(SAMPLE_RATE),
  }
}

export function toQuery(params: Params): URLSearchParams {
  const query = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) for (const one of [v].flat()) query.append(k, one)
  return query
}

// The Request card: only the params that matter to the feature, in a form a reader can copy.
export function describeRequest(model: Model, feature: Params): string {
  return `/${model.endpoint}/listen?${toQuery(shownParams(model, feature))}`
}

export const formatMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, '')} MB`
export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
