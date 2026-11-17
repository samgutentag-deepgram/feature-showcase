// One Deepgram socket per session, Nova-3 on /v1/listen or Flux on /v2/listen.
// Both are normalized to the same shape: a list of words, each with a language tag.
import { DeepgramClient } from '@deepgram/sdk'
import { fetchToken, requestParams } from '../common/config'
import type { Json, Model, Params, Word } from '../common/feature'
import { declaredFormat, transcode, type AudioFormat } from './audio'

export interface TranscriptUpdate {
  // Final words are kept; interim words replace the previous interim batch.
  final: boolean
  words: Word[]
  // The message itself, for the feature's echo().
  raw: Json
}

export interface StreamHandlers {
  onUpdate(u: TranscriptUpdate): void
  onError(message: string): void
  onClose(): void
  // Every server message, before it is parsed, Error included. For timelines and action acks.
  onMessage?(msg: Json): void
}

export interface StreamOptions {
  // The audio actually sent, when it should differ from what the params declare. Defaults to the
  // declared encoding and sample_rate (linear16 at 16 kHz unless the feature says otherwise).
  audio?: AudioFormat
}

export interface Stream {
  // 16 kHz linear16 from capture; converted to the stream's audio format before it is sent.
  send(pcm: ArrayBuffer): void
  // A text frame, exactly as given (Configure, Finalize, KeepAlive, ForceEndTurn, CloseStream).
  sendText(msg: Json): void
  // Flush what Deepgram is holding, then close once it has answered.
  finish(): void
  close(): void
}

const CONNECT_TIMEOUT_MS = 10_000
// How long finish() waits for Flux to answer ForceEndTurn before closing anyway.
export const FLUX_FLUSH_MS = 3_000

// Close codes a visitor might actually see, in words. The code stays at the end for a bug report.
export function closeMessage(code: number, reason?: string): string {
  const why =
    // NET-0001 is Deepgram's idle timeout (checked live 2026-11-16: close 1011 about 12 s after the
    // last audio when no KeepAlive was sent). It is not a fault on Deepgram's side.
    reason?.includes('NET-0001') || reason?.includes('net0001')
      ? 'Deepgram closed the stream after about 10 to 12 seconds with no audio and no KeepAlive.'
      : code === 1008 || code === 4001 || code === 4003
      ? 'Deepgram did not accept the session. Try again.'
      : code === 1011 || code === 1013
        ? 'Deepgram hit a problem on its side. Try again in a moment.'
        : 'The connection to Deepgram closed early. Try again.'
  return `${why} (${code}${reason ? `: ${reason}` : ''})`
}

export function parseNova(msg: Json): TranscriptUpdate | null {
  if (msg.type !== 'Results') return null
  const alt = (msg.channel as Json | undefined)?.alternatives as Json[] | undefined
  const first = alt?.[0]
  if (!first) return null
  const fallback = ((first.languages as string[] | undefined) ?? [])[0] ?? ''
  const words: Word[] = ((first.words as Json[] | undefined) ?? []).map((w) => ({
    text: String(w.punctuated_word ?? w.word ?? ''),
    lang: String(w.language ?? fallback),
    ...(typeof w.speaker === 'number' ? { speaker: w.speaker } : {}),
  }))
  // speech_final: Nova decided the speaker stopped (endpointing). Mark where the turn ended.
  if (msg.speech_final === true && words.length) words[words.length - 1] = { ...words[words.length - 1], endsTurn: true }
  return { final: msg.is_final === true, words, raw: msg }
}

// Flux reports language per turn, at the top level of each TurnInfo event.
export function parseFlux(msg: Json): TranscriptUpdate | null {
  if (msg.type !== 'TurnInfo') return null
  const transcript = String(msg.transcript ?? '').trim()
  const lang = ((msg.languages as string[] | undefined) ?? [])[0] ?? ''
  const final = msg.event === 'EndOfTurn'
  const words: Word[] = transcript ? transcript.split(/\s+/).map((text) => ({ text, lang })) : []
  if (final && words.length) words[words.length - 1] = { ...words[words.length - 1], endsTurn: true }
  return { final, words, raw: msg }
}

// The finished text of a message, from either model: a final Nova Results, or a Flux EndOfTurn.
// Undefined for anything else, so a feature's echo() keeps its last value.
export function finalTranscript(msg: Json): string | undefined {
  if (msg.type === 'Results' && msg.is_final === true) {
    const alt = ((msg.channel as Json | undefined)?.alternatives as Json[] | undefined)?.[0]
    return String(alt?.transcript ?? '') || undefined
  }
  if (msg.type === 'TurnInfo' && msg.event === 'EndOfTurn') return String(msg.transcript ?? '') || undefined
  return undefined
}

export async function openStream(model: Model, params: Params, h: StreamHandlers, opts: StreamOptions = {}): Promise<Stream> {
  const sent = requestParams(model, params)
  const format = opts.audio ?? declaredFormat(sent)
  // Fails here, before a token is spent, if the page cannot produce that format.
  transcode(new ArrayBuffer(0), format)
  const token = await fetchToken()
  const client = new DeepgramClient({ accessToken: token })
  const args = {
    ...sent,
    Authorization: `Bearer ${token}`,
    // The token lives 30 s, so a reconnect would fail anyway. End the session instead.
    reconnectAttempts: 0,
  }
  // The SDK's per-endpoint arg types are narrower than the shared param record.
  const v2 = model.endpoint === 'v2'
  const socket = v2
    ? await client.listen.v2.connect(args as unknown as Parameters<typeof client.listen.v2.connect>[0])
    : await client.listen.v1.connect(args as unknown as Parameters<typeof client.listen.v1.connect>[0])

  const parse = v2 ? parseFlux : parseNova
  let flushing = false
  let flushTimer: number | undefined
  let streamClosed = false
  const closeStream = () => {
    window.clearTimeout(flushTimer)
    if (streamClosed || socket.readyState !== 1) return
    streamClosed = true
    socket.sendCloseStream({ type: 'CloseStream' })
  }
  let closed = false
  let errored = false
  const fail = (message: string) => {
    errored = true
    h.onError(message)
  }
  // onClose fires exactly once, whether Deepgram closes the socket or we do.
  const end = () => {
    if (closed) return
    closed = true
    h.onClose()
  }
  socket.on('message', (msg) => {
    const m = msg as unknown as Json
    h.onMessage?.(m)
    if (m.type === 'Error') {
      fail(`Deepgram returned an error: ${String(m.description ?? m.message ?? 'no details')}`)
      return
    }
    const update = parse(m)
    if (update) h.onUpdate(update)
    // Flux answered the ForceEndTurn from finish(): the last turn is in, so close now.
    if (flushing && m.type === 'TurnInfo' && m.event === 'EndOfTurn') closeStream()
  })
  socket.on('error', () => fail('Lost the connection to Deepgram. Try again.'))
  socket.on('close', (ev) => {
    // 1000 is a clean close. Anything else is worth telling the user about, unless
    // Deepgram already said why.
    const clean = ev.code === 1000 || ev.code === 1005
    if (!closed && !clean && !errored) fail(closeMessage(ev.code, ev.reason))
    end()
  })

  // SDK sockets start closed; connect() opens them. A stalled handshake should not hang the page.
  socket.connect()
  let timeout: number | undefined
  try {
    await Promise.race([
      socket.waitForOpen(),
      new Promise((_, reject) => {
        timeout = window.setTimeout(() => reject(new Error('Could not reach Deepgram. Try again.')), CONNECT_TIMEOUT_MS)
      }),
    ])
  } catch (err) {
    closed = true
    socket.close()
    throw err
  } finally {
    window.clearTimeout(timeout)
  }

  return {
    send(pcm) {
      if (socket.readyState === 1) socket.sendMedia(transcode(pcm, format))
    },
    sendText(msg) {
      // The SDK has one typed method per message; the raw socket sends any of them as shown.
      if (socket.readyState === 1) (socket as unknown as { socket: { send(data: string): void } }).socket.send(JSON.stringify(msg))
    },
    finish() {
      if (socket.readyState !== 1 || flushing) return
      if (!v2) {
        closeStream()
        return
      }
      // CloseStream alone makes Flux close at once and drop a turn still in progress. Ask it to end
      // the turn first; closeStream runs on the EndOfTurn, or after FLUX_FLUSH_MS if none comes.
      flushing = true
      ;(socket as unknown as { sendForceEndTurn(m: { type: 'ForceEndTurn' }): void }).sendForceEndTurn({ type: 'ForceEndTurn' })
      flushTimer = window.setTimeout(closeStream, FLUX_FLUSH_MS)
    },
    close() {
      socket.close()
      end()
    },
  }
}
