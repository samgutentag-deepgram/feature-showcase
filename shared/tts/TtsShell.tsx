// The page every text-to-speech demo shares: type or pick a line, pick a voice, set the feature,
// press Speak. The last two runs stay side by side with their timings and a Replay button.
// A feature with cutIn speaks over the socket instead and offers Cut in while the line plays.
// A feature with close speaks over the socket and closes it mid-line, with Close or by dropping it.
import { useEffect, useRef, useState } from 'react'
import { LINKS, dgLink, sourceLink, type Button, type Placement } from '../common/links'
import { TakeHome } from '../common/TakeHome'
import type { Params } from '../common/feature'
import type { TtsFeature } from './feature'
import { isFlux, replay, speak, speakPath, speakQuery, voiceName, type SpeakStats } from './speak'
import { listenForTurn, type Listener } from './listen'
import { sessionUrl, speakSession, type Turn } from './session'
import { LATE_MS, speakTokens, tokenUrl, type TokenStats } from './tokens'
import { cutMessage, socketUrl, speakSocket, type CutStats } from './socket'
import { CLOSE_MESSAGE, closeMidLine, speakThenClose, type CloseStats, type SessionTotals } from './close'
import { speakLineup, spread, type LineupRow } from './lineup'
import { Spectrum } from './Spectrum'
import { CALLBACK_SHOWN, TEXT_URL_SHOWN, callbackBody, isLow, openSlot, requestCallback, unreachable, waitForAudio } from './callback'
import './tts.css'

interface Run<S> {
  id: number
  label: string
  voice: string
  state: S
  text: string
  stats?: SpeakStats
  buffers?: AudioBuffer[]
  // Bytes in so far, while a file is still arriving.
  received?: number
  // Whether this run waits for the whole file before it plays.
  file?: boolean
  cut?: CutStats
  // Close mode: how the socket was closed and what came after.
  close?: CloseStats
  // Token mode: the reply as typed so far, and the timeline once done.
  shown?: string
  tokenStats?: TokenStats
  // Session mode: every turn on the socket, as reported.
  turns?: Turn[]
  // Session mode with close: SessionMetadata, the totals after Close.
  totals?: SessionTotals
  // How the cut came: the button (or space bar), or the listener's voice, with the first word heard.
  cutBy?: 'button' | 'voice'
  cutWord?: string
  // Lineup mode: each voice's loudness, and which one is playing (-1 when none).
  lineup?: LineupRow[]
  playing?: number
  error?: string
  // Callback mode: what Deepgram answered, then what the webhook brought.
  cb?: CallbackRun
}

interface CallbackRun {
  callback: string
  textUrl: string
  requestId?: string
  acceptedMs?: number
  // Seconds waited so far for the webhook.
  waitedS?: number
  textFetchedMs?: number
  method?: string
  contentType?: string
  bytes?: number
  afterMs?: number
  // The webhook is on this machine, so Deepgram cannot reach it.
  local?: boolean
}

const MAX_CHARS = 400
const VOICE_GROUPS = [
  { label: 'Flux', flux: true },
  { label: 'Aura-2', flux: false },
]
const ms = (n: number) => `${Math.round(n)} ms`
// Small compressed files differ by a few KB, so they keep a decimal.
const kb = (bytes: number) => (bytes / 1024).toFixed(bytes < 100 * 1024 ? 1 : 0)

export function TtsShell<S>({ feature }: { feature: TtsFeature<S> }) {
  const midClose = closeMidLine(feature)
  const [state, setState] = useState<S>(feature.initialState)
  // Session mode reads the controls between turns, after the click that started the run.
  const stateRef = useRef(state)
  stateRef.current = state
  const [pickedVoice, setVoice] = useState(feature.voices[0])
  // A feature can pick the voice itself (a voice browser); the picker then hides.
  // A Flux-only setting (callback priority=low) falls back to the default Flux voice.
  const voiceFor = (st: S) => (feature.voiceFrom ? feature.voiceFrom(st) : feature.callback?.fluxOnly?.(st) && !isFlux(pickedVoice) ? feature.voices[0] : pickedVoice)
  const voice = voiceFor(state)
  const fluxOnly = feature.callback?.fluxOnly?.(state) ?? false
  const [text, setText] = useState(feature.textFor?.(feature.initialState) ?? feature.phrases[0] ?? '')
  const [runs, setRuns] = useState<Run<S>[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const ctx = useRef<AudioContext | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  const lastId = useRef(0)
  const cutRef = useRef<(() => void) | null>(null)
  const [cutting, setCutting] = useState(false)
  // Voice cut-in: whether the mic is listening for this run, or could not start.
  const [mic, setMic] = useState<'off' | 'on' | 'denied'>('off')
  const link = (href: string, placement: Placement, button: Button) => dgLink(href, placement, button)

  useEffect(() => () => stopRef.current?.(), [])

  // Socket mode: the space bar cuts in too, so the eyes can stay on the run cards.
  useEffect(() => {
    if (!feature.cutIn || !busy || cutting) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      e.preventDefault()
      cutRef.current?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [feature.cutIn, busy, cutting])

  // One context for the page, made on the first click so autoplay rules allow it.
  const audio = () => {
    if (!ctx.current) {
      const c = new AudioContext()
      const a = c.createAnalyser()
      a.fftSize = 2048
      a.connect(c.destination)
      ctx.current = c
      setAnalyser(a)
      return { c, a }
    }
    return { c: ctx.current, a: analyser as AnalyserNode }
  }

  // st: the setting to speak with. A step button passes its own, since state has not updated yet.
  const go = async (st: S = state) => {
    const voice = voiceFor(st)
    // A feature with its own line per setting (a language) speaks that line when the pick changes it.
    const own = feature.textFor?.(st)
    const line = (own !== undefined && own !== feature.textFor?.(state) ? own : text).trim().slice(0, MAX_CHARS)
    if (!line) return
    setError('')
    stopRef.current?.()
    const { c, a } = audio()
    await c.resume()
    const id = ++lastId.current
    const file = !feature.cutIn && !midClose && !feature.callback && feature.params(st).container !== 'none'
    setRuns((rs) => [{ id, label: feature.runLabel(st), voice, state: st, text: line, file }, ...rs].slice(0, 2))
    setBusy(true)
    setCutting(false)
    try {
      const { cutIn } = feature
      if (midClose) {
        const p = await speakThenClose(c, a, socketUrl(voice, feature.params(st)), feature.params(st), line, midClose.graceful(st), midClose.afterMs)
        if (lastId.current !== id) {
          p.stop()
          throw new DOMException('Stopped', 'AbortError')
        }
        stopRef.current = p.stop
        const { stats, buffers, close } = await p.done
        setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, stats, buffers, close } : r)))
      } else if (feature.callback) {
        const controller = new AbortController()
        stopRef.current = () => controller.abort()
        const update = (patch: Partial<CallbackRun>) => setRuns((rs) => rs.map((r) => (r.id === id && r.cb ? { ...r, cb: { ...r.cb, ...patch } } : r)))
        const params = feature.params(st)
        const slot = await openSlot(line)
        if (lastId.current !== id) throw new DOMException('Stopped', 'AbortError')
        setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, cb: { callback: slot.callback, textUrl: slot.textUrl, local: unreachable(slot.callback) } } : r)))
        // Running on this machine: Deepgram refuses a callback it cannot reach, so say so and stop.
        if (unreachable(slot.callback)) return
        const accepted = await requestCallback(voice, params, slot, line, controller.signal)
        update(accepted)
        const t0 = Date.now()
        const delivery = await waitForAudio(slot.id, controller.signal, (textFetchedMs) => update({ waitedS: Math.round((Date.now() - t0) / 1000), textFetchedMs }))
        const decoded = await c.decodeAudioData(delivery.audio.slice(0))
        update({ method: delivery.method, contentType: delivery.contentType, bytes: delivery.audio.byteLength, afterMs: delivery.afterMs, textFetchedMs: delivery.textFetchedMs })
        if (lastId.current !== id || controller.signal.aborted) throw new DOMException('Stopped', 'AbortError')
        const stopPlay = replay(c, a, [decoded])
        stopRef.current = stopPlay
        const stats = { contentType: delivery.contentType, bytes: delivery.audio.byteLength, firstByteMs: 0, firstAudioMs: delivery.afterMs, lastByteMs: 0, seconds: decoded.duration }
        setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, stats, buffers: [decoded] } : r)))
      } else if (feature.tokens) {
        const onText = (shown: string) => setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, shown } : r)))
        const p = await speakTokens(c, a, voice, feature.params(st), line, feature.tokens.mode(st), feature.tokens.tokenMs, onText)
        if (lastId.current !== id) {
          p.stop()
          throw new DOMException('Stopped', 'AbortError')
        }
        stopRef.current = p.stop
        const { buffers, stats: tokenStats } = await p.done
        const stats = { contentType: '', bytes: 0, firstByteMs: 0, firstAudioMs: tokenStats.firstAudioMs, lastByteMs: 0, seconds: tokenStats.totalS }
        setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, stats, buffers, tokenStats } : r)))
      } else if (feature.session) {
        const onTurns = (turns: Turn[]) => setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, turns } : r)))
        const p = await speakSession(c, a, voice, feature, () => stateRef.current, line, onTurns)
        if (lastId.current !== id) {
          p.stop()
          throw new DOMException('Stopped', 'AbortError')
        }
        stopRef.current = p.stop
        const { buffers, turns, totals, seconds, firstAudioMs } = await p.done
        const stats = { contentType: '', bytes: 0, firstByteMs: 0, firstAudioMs, lastByteMs: 0, seconds }
        setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, stats, buffers, turns, totals } : r)))
      } else if (cutIn) {
        let listener: Listener | null = null
        let cutDone = false
        const cutNow = (by: 'button' | 'voice', word = '') => {
          // A turn that starts before the line is playing is ignored; the next one still counts.
          if (cutDone || !p) return
          cutDone = true
          setCutting(true)
          setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, cutBy: by, cutWord: word } : r)))
          p?.cut(cutIn.reply, cutIn.interrupt(st))
        }
        let p: Awaited<ReturnType<typeof speakSocket>> | null = null
        if (cutIn.listen) {
          try {
            listener = await listenForTurn((word) => cutNow('voice', word))
            setMic('on')
          } catch {
            setMic('denied')
          }
        }
        try {
          p = await speakSocket(c, a, voice, feature.params(st), line)
          if (lastId.current !== id) {
            p.stop()
            throw new DOMException('Stopped', 'AbortError')
          }
          const stopSpeech = p.stop
          stopRef.current = () => {
            listener?.stop()
            stopSpeech()
          }
          cutRef.current = () => cutNow('button')
          const { stats, buffers, cut } = await p.done
          setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, stats, buffers, cut } : r)))
        } finally {
          listener?.stop()
          setMic('off')
        }
      } else if (feature.lineup) {
        const onUpdate = (lineup: LineupRow[], playing?: number) =>
          setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, lineup, ...(playing === undefined ? {} : { playing }) } : r)))
        const p = await speakLineup(c, a, feature.voices, feature.params(st), line, onUpdate)
        if (lastId.current !== id) {
          p.stop()
          throw new DOMException('Stopped', 'AbortError')
        }
        stopRef.current = p.stop
        const { stats, buffers, rows } = await p.done
        setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, stats, buffers, lineup: rows } : r)))
      } else {
        const onProgress = file ? (received: number) => setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, received } : r))) : undefined
        const p = await speak(c, a, voice, feature.params(st), line, onProgress)
        // A newer pick came in while this one was still asking for a token: stop before it plays.
        if (lastId.current !== id) {
          p.stop()
          throw new DOMException('Stopped', 'AbortError')
        }
        stopRef.current = p.stop
        const { stats, buffers } = await p.done
        setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, stats, buffers } : r)))
      }
    } catch (err) {
      // Stopped because a newer run started: say so on its card, with no error banner.
      const replaced = lastId.current !== id
      const aborted = (err as Error).name === 'AbortError'
      const message = aborted ? (replaced ? 'Stopped for the new setting.' : 'Stopped.') : (err as Error).message
      setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, error: message } : r)))
      if (!replaced) setError(message)
    } finally {
      if (lastId.current === id) {
        setBusy(false)
        cutRef.current = null
      }
    }
  }

  // A pick from Controls: new line if the feature has one per setting, then speak at once if it restarts on pick.
  const pick = (next: S) => {
    const own = feature.textFor?.(next)
    if (own !== undefined && own !== feature.textFor?.(state)) setText(own)
    setState(next)
    if (feature.restartOnPick) void go(next)
  }

  const again = (r: Run<S>) => {
    if (!r.buffers) return
    stopRef.current?.()
    const { c, a } = audio()
    void c.resume()
    stopRef.current = replay(c, a, r.buffers)
  }

  const params = feature.params(state)
  const latestCb = runs[0]?.cb
  // Callback mode: the card shows this run's real webhook once it has one, readable, not encoded.
  const shownCallback = latestCb?.callback ?? CALLBACK_SHOWN
  const shownTextUrl = latestCb?.textUrl ?? TEXT_URL_SHOWN
  const latest = runs[0]
  // A lineup shows the request for the voice playing now, the first voice otherwise.
  const shownVoice = feature.lineup && latest?.lineup && (latest.playing ?? -1) >= 0 ? latest.lineup[latest.playing ?? 0].voice : voice
  const query = speakQuery(shownVoice, params)
    .split('&')
    .map((part) => (feature.callback && part.startsWith('callback=') ? `callback=${shownCallback}` : part))
  const marked = (part: string) => feature.highlight.some((k) => part.startsWith(`${k}=`))
  const socket = !!feature.cutIn
  // Session mode: the query holds only the audio format; the rest goes in Configure.
  const sessionPath = feature.session
    ? sessionUrl(voice, params, Object.keys(feature.session.configure?.(state) ?? {})).replace('wss://api.deepgram.com', '')
    : ''
  const interrupt = feature.cutIn?.interrupt(state) ?? false
  // The playback_offset value is an example until a run has a real one.
  const cutShown = latest?.cut?.sent ?? (interrupt ? cutMessage(voice, 2340) : null)
  const line = text.trim().slice(0, MAX_CHARS)
  const { Controls } = feature

  return (
    <main className="page">
      <header className="masthead">
        <img src="/deepgram-logo.svg" alt="Deepgram" className="masthead__logo" />
        <nav className="masthead__nav" aria-label="Deepgram">
          <a className="btn btn--ghost" href={link(feature.links.docs, 'header', 'docs')}>
            Docs
          </a>
          <a className="btn btn--ghost btn--hide-sm" href={link(LINKS.playground, 'header', 'playground')}>
            Playground
          </a>
          <a className="btn btn--primary" href={link(LINKS.signup, 'header', 'signup')}>
            Free API key
          </a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero__copy">
          <h1>{feature.copy.headline}</h1>
          <p>{feature.copy.lede}</p>
        </div>
        <div className="hero__art" aria-hidden="true" />
      </section>

      <section className="panel controls">
        <label className="tts-text">
          <span className="tts-text__label">Text to speak</span>
          <textarea value={text} maxLength={MAX_CHARS} rows={3} disabled={busy} onChange={(e) => setText(e.target.value)} />
        </label>
        <div className="tts-phrases" aria-label="Lines to try">
          {feature.phrases.map((p) => (
            <button key={p} className="tts-chip" disabled={busy} onClick={() => setText(p)}>
              {p.length > 48 ? `${p.slice(0, 46)}…` : p}
            </button>
          ))}
        </div>
        {!feature.voiceFrom && !feature.lineup && (
        <label className="tts-voice">
          <span className="tts-text__label">Voice</span>
          <select value={voice} disabled={busy} onChange={(e) => setVoice(e.target.value)}>
            {VOICE_GROUPS.map(({ label, flux }) => {
              const vs = feature.voices.filter((v) => isFlux(v) === flux)
              return vs.length ? (
                <optgroup key={label} label={label}>
                  {vs.map((v) => (
                    <option key={v} value={v} disabled={fluxOnly && !isFlux(v)}>
                      {voiceName(v)}
                    </option>
                  ))}
                </optgroup>
              ) : null
            })}
          </select>
        </label>
        )}
        {feature.auraOnly && <p className="note">{feature.auraOnly}</p>}

        {(feature.restartOnPick || feature.session?.configure) && !feature.voiceFrom ? (
          <>
            <div className="tts-playrow">
              <div className="actions">
                {busy ? (
                  <>
                    {socket && (
                      <button className={cutting ? 'btn btn--primary' : 'btn btn--primary tts-cutin'} onClick={() => cutRef.current?.()} disabled={cutting}>
                        Cut in
                      </button>
                    )}
                    <button className="btn btn--stop" onClick={() => stopRef.current?.()}>
                      <span className="dot" /> Stop
                    </button>
                    {socket && (
                      <span className="hint" aria-live="polite">
                        {cutting
                          ? 'You cut in. The reply is on its way.'
                          : mic === 'on'
                            ? 'Listening: just start talking to cut in. Or press Cut in, or the space bar.'
                            : mic === 'denied'
                              ? 'No mic, so press Cut in or the space bar to cut in.'
                              : 'Talk over it: press Cut in, or the space bar.'}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <button className="btn btn--primary" onClick={() => go()} disabled={!text.trim()}>
                      Speak
                    </button>
                    {socket && (
                      <span className="hint">
                        {feature.cutIn?.listen
                          ? 'Then talk over it to cut in, the way a caller would. Headphones help: without them the mic can hear the voice. Cut in and the space bar work too.'
                          : 'Then press Cut in, or the space bar, while it is still talking.'}
                      </span>
                    )}
                  </>
                )}
              </div>
              <Controls
                state={state}
                // A feature that restarts on pick speaks right away with the setting just picked.
                setState={pick}
                busy={busy && !feature.restartOnPick && !feature.session}
              />
            </div>
            <p className="hint">
              {feature.session?.configure && !feature.restartOnPick
                ? 'Pick one any time: the next turn uses it, on the same socket, with no reconnect.'
                : 'Pick one any time: it stops and starts the line over with that setting.'}
            </p>
          </>
        ) : (
          <>
            <Controls
              state={state}
              // A feature that restarts on pick speaks right away with the setting just picked.
              setState={pick}
              busy={busy && !feature.restartOnPick && !feature.session}
            />

            <div className="actions">
              {busy ? (
                <>
                  {socket && (
                    <button className={cutting ? 'btn btn--primary' : 'btn btn--primary tts-cutin'} onClick={() => cutRef.current?.()} disabled={cutting}>
                      Cut in
                    </button>
                  )}
                  <button className="btn btn--stop" onClick={() => stopRef.current?.()}>
                    <span className="dot" /> Stop
                  </button>
                  {socket && (
                    <span className="hint" aria-live="polite">
                      {cutting
                        ? 'You cut in. The reply is on its way.'
                        : mic === 'on'
                          ? 'Listening: just start talking to cut in. Or press Cut in, or the space bar.'
                          : mic === 'denied'
                            ? 'No mic, so press Cut in or the space bar to cut in.'
                            : 'Talk over it: press Cut in, or the space bar.'}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <button className="btn btn--primary" onClick={() => go()} disabled={!text.trim()}>
                    Speak
                  </button>
                  {socket && (
                    <span className="hint">
                      {feature.cutIn?.listen
                        ? 'Then talk over it to cut in, the way a caller would. Headphones help: without them the mic can hear the voice. Cut in and the space bar work too.'
                        : 'Then press Cut in, or the space bar, while it is still talking.'}
                    </span>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {busy && latest?.file && !latest.stats && <FileProgress run={latest} params={feature.params(latest.state)} />}

        {error && <p className="error" role="alert">{error}</p>}

        <div className="wire">
          <div className="wire__block">
            <span className="wire__label">Request</span>
            <code>
              <span className="wire__part">{socket || feature.session || feature.tokens || feature.close ? 'WSS' : 'POST'} {speakPath(voice)}</span>
              {(feature.session ? sessionPath.split('?')[1].split('&') : feature.tokens ? tokenUrl(voice, params).split('?')[1].split('&') : query).map((part, i) => {
                const t = `${i === 0 ? '?' : '&'}${part}`
                return (
                  <span className="wire__part" key={i}>
                    {marked(part) ? <mark>{t}</mark> : t}
                  </span>
                )
              })}
              {midClose ? (
                <>
                  <span className="wire__part wire__part--text tts-body">
                    <span className="wire__key">send</span> {JSON.stringify({ type: 'Speak', text: line })}
                  </span>
                  <span className="wire__part wire__part--text tts-body">
                    <span className="wire__key">{midClose.afterMs} ms later</span>{' '}
                    {midClose.graceful(state) ? (
                      <mark>{JSON.stringify(CLOSE_MESSAGE)}</mark>
                    ) : (
                      <span className="wire__key">nothing; the page calls ws.close()</span>
                    )}
                  </span>
                </>
              ) : feature.tokens ? (
                <span className="wire__part wire__part--text tts-body">
                  {feature.tokens.mode(state) === 'whole' ? (
                    <>
                      <span className="wire__key">when the reply is done</span> <mark>{JSON.stringify({ type: 'Speak', text: '<whole reply>' })}</mark>{' '}
                      {'{"type":"Flush"}'}
                    </>
                  ) : (
                    <>
                      <span className="wire__key">per token</span> <mark>{JSON.stringify({ type: 'Speak', text: '<token> ' })}</mark>{' '}
                      <span className="wire__key">{feature.tokens.mode(state) === 'late' ? `${LATE_MS / 1000} s after the last token` : 'after the last token'}</span>{' '}
                      {'{"type":"Flush"}'}
                    </>
                  )}
                </span>
              ) : feature.session ? (
                <span className="wire__part wire__part--text tts-body">
                  <span className="wire__key">per turn</span>{' '}
                  {feature.session.configure && <mark>{JSON.stringify({ type: 'Configure', ...feature.session.configure(state) })}</mark>}{' '}
                  {JSON.stringify({ type: 'Speak', text: '<sentence>' })} {'{"type":"Flush"}'}
                  {feature.close && (
                    <>
                      {' '}
                      <span className="wire__key">after the last turn</span> <mark>{'{"type":"Close"}'}</mark>
                    </>
                  )}
                </span>
              ) : socket && feature.cutIn ? (
                <>
                  <span className="wire__part wire__part--text tts-body">
                    <span className="wire__key">send</span> {JSON.stringify({ type: 'Speak', text: line })} {'{"type":"Flush"}'}
                  </span>
                  <span className="wire__part wire__part--text tts-body">
                    <span className="wire__key">on cut-in</span>{' '}
                    {cutShown ? <mark>{JSON.stringify(cutShown)}</mark> : <span className="wire__key">nothing; playback stops in the browser only</span>}{' '}
                    {JSON.stringify({ type: 'Speak', text: feature.cutIn.reply })} {'{"type":"Flush"}'}
                  </span>
                </>
              ) : (
                <>
                  <span className="wire__part wire__part--text tts-body">
                    <span className="wire__key">body</span>{' '}
                    {feature.callback && isLow(params) ? <mark>{JSON.stringify(callbackBody(params, line, shownTextUrl))}</mark> : JSON.stringify({ text: line })}
                  </span>
                  {feature.lineup && (
                    <span className="wire__part wire__part--text tts-body">
                      <span className="wire__key">sent once per voice, only model changes:</span> {feature.voices.map(voiceName).join(', ')}
                    </span>
                  )}
                </>
              )}
            </code>
          </div>
          <div className="wire__block">
            <span className="wire__label">Response</span>
            <code>
              {latest?.close ? (
                <span className="wire__part wire__part--text">
                  {latest.close.after.map((m, i) => (
                    <span key={i}>
                      <mark>{JSON.stringify(closeShown(m))}</mark>{' '}
                    </span>
                  ))}
                  <span className="wire__key">
                    {latest.close.after.length ? 'then ' : latest.close.graceful ? 'no message, then ' : 'nothing more, '}socket closed ({latest.close.code}) {ms(latest.close.closedMs)} in
                  </span>
                </span>
              ) : feature.callback && latest?.cb ? (
                <>
                  <span className="wire__part wire__part--text">
                    {latest.cb.local ? (
                      <span className="wire__key">Not sent: Deepgram cannot deliver to a server on your machine.</span>
                    ) : latest.cb.requestId ? (
                      <>
                        <mark>{JSON.stringify({ request_id: latest.cb.requestId })}</mark> in {ms(latest.cb.acceptedMs ?? 0)}, no audio
                      </>
                    ) : (
                      <span className="wire__key">Sending…</span>
                    )}
                  </span>
                  {latest.cb.method && (
                    <span className="wire__part wire__part--text tts-body">
                      <span className="wire__key">then, to the callback</span> <mark>{latest.cb.method}</mark> {latest.cb.contentType},{' '}
                      {(latest.cb.bytes ?? 0).toLocaleString()} bytes, {((latest.cb.afterMs ?? 0) / 1000).toFixed(1)} s later
                    </span>
                  )}
                </>
              ) : latest?.cut?.ack ? (
                <span className="wire__part wire__part--text">
                  <mark>{JSON.stringify(ackShown(latest.cut.ack))}</mark> in {ms(latest.cut.ackMs ?? 0)}
                </span>
              ) : latest?.cut ? (
                <span className="wire__part wire__part--text">
                  <span className="wire__key">Nothing sent, so nothing back: the rest of the line kept streaming.</span>
                </span>
              ) : latest?.totals ? (
                <span className="wire__part wire__part--text">
                  <span className="wire__key">after Close, in {ms(latest.totals.afterCloseMs)}:</span>{' '}
                  <mark>
                    {JSON.stringify({
                      type: 'SessionMetadata',
                      total_audio_duration_ms: latest.totals.audioMs,
                      total_input_character_count: latest.totals.inputChars,
                      total_billable_character_count: latest.totals.billableChars,
                    })}
                  </mark>
                </span>
              ) : latest?.turns?.length ? (
                <span className="wire__part wire__part--text">
                  <span className="wire__key">last turn:</span>{' '}
                  <mark>
                    {JSON.stringify({
                      type: 'SpeechMetadata',
                      speech_id: latest.turns.at(-1)?.speechId,
                      audio_duration_ms: latest.turns.at(-1)?.audioMs,
                      billable_character_count: latest.turns.at(-1)?.billableChars,
                    })}
                  </mark>
                </span>
              ) : latest?.stats ? (
                <span className="wire__part wire__part--text">
                  <span className="wire__key">content-type:</span> <mark>{latest.stats.contentType}</mark>,{' '}
                  {latest.stats.bytes.toLocaleString()} bytes, first byte {ms(latest.stats.firstByteMs)}
                </span>
              ) : (
                <span className="wire__key">The response headers and size show up here after you press Speak.</span>
              )}
            </code>
          </div>
        </div>
        <TakeHome />
      </section>

      <section className="panel">
        <Spectrum analyser={analyser} phoneMark={feature.phoneMark} />
      </section>

      {runs.length > 0 && (
        <div className={runs.length > 1 ? 'runs runs--compare' : 'runs'}>
          {[...runs].reverse().map((r) => (
            <section className="panel tts-run" key={r.id}>
              <header className="run__head">
                <span className="run__num">Run {r.id}</span>
                <span className="run__label">{r.label}</span>
              </header>
              {r.error ? (
                <p className="error">{r.error}</p>
              ) : r.shown !== undefined && !r.error ? (
                <>
                  <p className="tts-typed">{r.shown}</p>
                  {r.tokenStats ? (
                    <dl className="tts-stats">
                      <dt>Reply text done</dt>
                      <dd>{ms(r.tokenStats.textDoneMs)}</dd>
                      <dt>First audio</dt>
                      <dd>{ms(r.tokenStats.firstAudioMs)}</dd>
                      <dt>Flush sent</dt>
                      <dd>{ms(r.tokenStats.flushMs)}</dd>
                      <dt>Audio before Flush</dt>
                      <dd>
                        {r.tokenStats.beforeFlushS.toFixed(1)} of {r.tokenStats.totalS.toFixed(1)} s
                      </dd>
                    </dl>
                  ) : (
                    <p className="hint">The reply is arriving a word at a time…</p>
                  )}
                </>
              ) : r.turns ? (
                <table className="tts-turns">
                  <thead>
                    <tr>
                      <th>Turn</th>
                      <th>speech_id</th>
                      {feature.session?.configure && <th>Setting</th>}
                      <th>Audio</th>
                      <th>Billed</th>
                      <th>Text</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.turns.map((t, i) => (
                      <tr key={i} className={t.audioMs === undefined ? 'is-pending' : ''}>
                        <td>{i + 1}</td>
                        <td>
                          <code>{t.speechId ?? '…'}</code>
                        </td>
                        {feature.session?.configure && (
                          <td>
                            {t.label}
                            {t.configured && <span className="tts-turns__ok"> Configure ok</span>}
                          </td>
                        )}
                        <td>{t.audioMs === undefined ? '…' : `${(t.audioMs / 1000).toFixed(1)} s`}</td>
                        <td>{t.billableChars === undefined ? '…' : `${t.billableChars} chars`}</td>
                        <td className="tts-turns__text">{t.text}</td>
                      </tr>
                    ))}
                  </tbody>
                  {feature.close && <SessionFoot turns={r.turns} totals={r.totals} wide={!!feature.session?.configure} />}
                </table>
              ) : r.close ? (
                <>
                  <p className="hint">
                    {r.close.graceful
                      ? `The page sent Close ${ms(r.close.closeSentMs)} in. Deepgram finished the line, then closed the socket (${r.close.code}).`
                      : `The page closed the socket ${ms(r.close.closeSentMs)} in. Nothing arrived after that (${r.close.code}).`}
                  </p>
                  <dl className="tts-stats">
                    <dt>Audio before the close</dt>
                    <dd>{r.close.beforeS.toFixed(1)} s</dd>
                    <dt>Audio after the close</dt>
                    <dd>{r.close.afterS.toFixed(1)} s</dd>
                    <dt>Socket closed</dt>
                    <dd>{ms(r.close.closedMs)}</dd>
                  </dl>
                </>
              ) : r.cut ? (
                <>
                  {r.cutBy && (
                    <p className="hint">
                      {r.cutBy === 'voice' ? `You cut in by talking${r.cutWord ? `: "${r.cutWord}"` : ''}.` : 'You pressed Cut in.'}{' '}
                      {r.cut.sent
                        ? `The page sent ${(r.cut.sent as { type: string }).type}, so Deepgram stopped the old line at once.`
                        : 'Nothing told Deepgram to stop, so the reply waited behind the rest of the old line.'}
                    </p>
                  )}
                  <SpokenLine ack={r.cut.ack} />
                  {feature.cutIn?.buffer ? (
                    <dl className="tts-stats">
                      <dt>Heard before the cut</dt>
                      <dd>{(r.cut.heardMs / 1000).toFixed(1)} s</dd>
                      <dt>In the browser, never played</dt>
                      <dd>{(Math.max(r.cut.receivedMs - r.cut.heardMs, 0) / 1000).toFixed(1)} s</dd>
                      <dt>{r.cut.sent ? 'Arrived after the cut, dropped' : 'Rest of the line, dropped'}</dt>
                      <dd>{(r.cut.droppedMs / 1000).toFixed(1)} s</dd>
                      {r.cut.ack && (
                        <>
                          <dt>{String(r.cut.ack.type)} after</dt>
                          <dd>{ms(r.cut.ackMs ?? 0)}</dd>
                        </>
                      )}
                      <dt>Reply started after</dt>
                      <dd>{r.cut.replyFirstAudioMs === undefined ? '-' : ms(r.cut.replyFirstAudioMs)}</dd>
                    </dl>
                  ) : (
                    <dl className="tts-stats">
                      <dt>Heard before the cut</dt>
                      <dd>{(r.cut.heardMs / 1000).toFixed(1)} s</dd>
                      <dt>Reply started after</dt>
                      <dd>{r.cut.replyFirstAudioMs === undefined ? '-' : ms(r.cut.replyFirstAudioMs)}</dd>
                      <dt>Old line thrown away</dt>
                      <dd>{(r.cut.droppedMs / 1000).toFixed(1)} s</dd>
                    </dl>
                  )}
                </>
              ) : r.lineup ? (
                <LineupTable rows={r.lineup} playing={r.playing ?? -1} />
              ) : r.cb ? (
                <CallbackCard cb={r.cb} done={!!r.stats} seconds={r.stats?.seconds} />
              ) : r.stats ? (
                <dl className="tts-stats">
                  <dt>First audio</dt>
                  <dd>{ms(r.stats.firstAudioMs)}</dd>
                  <dt>Last byte</dt>
                  <dd>{ms(r.stats.lastByteMs)}</dd>
                  <dt>Audio</dt>
                  <dd>{r.stats.seconds.toFixed(1)} s</dd>
                  <dt>Size</dt>
                  <dd>{kb(r.stats.bytes)} KB</dd>
                </dl>
              ) : (
                <Waiting run={r} />
              )}
              {r.buffers && (
                <button className="btn btn--ghost" onClick={() => again(r)} disabled={busy}>
                  Replay
                </button>
              )}
            </section>
          ))}
        </div>
      )}

      <section className="cta">
        <div className="cta__copy">
          <h2>{feature.copy.ctaTitle}</h2>
          <p>{feature.copy.ctaBody}</p>
        </div>
        <div className="cta__actions">
          <a className="btn btn--dark" href={link(LINKS.signup, 'cta', 'signup')}>
            Get a free API key
          </a>
          <a className="btn btn--light" href={link(feature.links.docs, 'cta', 'docs')}>
            Read the docs
          </a>
          <a className="btn btn--light" href={link(LINKS.sales, 'cta', 'sales')}>
            Talk to sales
          </a>
        </div>
      </section>

      <footer className="foot">
        <a href={link(feature.links.docs, 'footer', 'docs')}>Docs</a>
        <a href={link(LINKS.playground, 'footer', 'playground')}>Playground</a>
        <a href={LINKS.discord}>Discord</a>
        <a href={sourceLink()}>View source</a>
        <a href={link(LINKS.signup, 'footer', 'signup')}>Get an API key</a>
      </footer>
    </main>
  )
}

// Only the fields the page talks about, so the Response card stays one line.
function ackShown(ack: Record<string, unknown>) {
  const { type, audio_played_ms, text_spoken, sequence_id } = ack
  return Object.fromEntries(Object.entries({ type, audio_played_ms, text_spoken, sequence_id }).filter(([, v]) => v !== undefined))
}

// Only the fields the page talks about from what arrives after Close.
function closeShown(m: Record<string, unknown>) {
  const { type, speech_id, audio_duration_ms, total_audio_duration_ms, total_billable_character_count } = m
  const keep = { type, speech_id, audio_duration_ms, total_audio_duration_ms, total_billable_character_count }
  return Object.fromEntries(Object.entries(keep).filter(([, v]) => v !== undefined))
}

// The line as Flux split it: what the listener heard, then what they never got to.
function SpokenLine({ ack }: { ack?: Record<string, unknown> }) {
  const spoken = typeof ack?.text_spoken === 'string' ? ack.text_spoken : null
  const remaining = typeof ack?.text_remaining === 'string' ? ack.text_remaining : null
  if (spoken === null || remaining === null) return null
  return (
    <p className="tts-spoken">
      <mark>{spoken}</mark>
      <s>{remaining}</s>
    </p>
  )
}

// While a run waits: a file shows its bytes arriving, so the silence reads as a download, not a hang.
function Waiting<S>({ run }: { run: Run<S> }) {
  if (!run.file) return <p className="hint">Speaking…</p>
  const kb = Math.round((run.received ?? 0) / 1024)
  return (
    <div className="tts-wait" role="status">
      <p className="hint">{kb ? `Downloading the file: ${kb} KB so far. Nothing plays until all of it is here.` : 'Asking for the file…'}</p>
      <div className="tts-wait__bar" aria-hidden="true">
        <span />
      </div>
    </div>
  )
}

// Waiting for a file, shown right under Speak: the KB in so far and a bar that fills against the
// expected size (about 14 characters a second, at the bit_rate asked for, or 16-bit audio), held
// short of full until it lands.
function FileProgress<S>({ run, params }: { run: Run<S>; params: Params }) {
  const received = run.received ?? 0
  const bytesPerSec = params.bit_rate
    ? Number(params.bit_rate) / 8
    : Number(params.sample_rate ?? 24000) * (params.encoding === 'mulaw' ? 1 : 2)
  const expected = (run.text.length / 14) * bytesPerSec
  const pct = Math.min(received / expected, 0.97) * 100
  const ext = params.encoding === 'mp3' ? 'mp3' : params.encoding === 'opus' ? 'ogg' : 'wav'
  return (
    <div className="tts-file" role="status">
      <div className="tts-file__head">
        <span className="tts-file__name">speech.{ext}</span>
        <span className="tts-file__kb">{Math.round(received / 1024)} KB</span>
      </div>
      <div className="tts-file__bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="hint">Downloading the whole file. Nothing plays until it is all here.</p>
    </div>
  )
}

// Lineup mode: one row per voice, the one playing now marked, and the spread underneath.
function LineupTable({ rows, playing }: { rows: LineupRow[]; playing: number }) {
  const db = (v?: number) => (v === undefined ? '…' : `${v.toFixed(1)} dB`)
  const s = spread(rows)
  return (
    <>
      <table className="tts-turns">
        <thead>
          <tr>
            <th>Voice</th>
            <th>Peak</th>
            <th>Speech level</th>
            <th>Audio</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.voice} className={r.speechDb === undefined ? 'is-pending' : i === playing ? 'is-playing' : ''}>
              <td>
                <code>{r.voice}</code>
              </td>
              <td>{db(r.peakDb)}</td>
              <td>{db(r.speechDb)}</td>
              <td>{r.seconds === undefined ? '…' : `${r.seconds.toFixed(1)} s`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {s !== undefined && (
        <dl className="tts-stats">
          <dt>Loudest to quietest</dt>
          <dd>{s.toFixed(1)} dB</dd>
        </dl>
      )}
    </>
  )
}

// Under a session's turns: what the turns add up to, then what SessionMetadata reported after Close.
function SessionFoot({ turns, totals, wide }: { turns: Turn[]; totals?: SessionTotals; wide: boolean }) {
  const done = turns.every((t) => t.audioMs !== undefined)
  const audio = turns.reduce((s, t) => s + (t.audioMs ?? 0), 0)
  const billed = turns.reduce((s, t) => s + (t.billableChars ?? 0), 0)
  const sent = turns.reduce((s, t, i) => s + t.text.length + (i < turns.length - 1 ? 1 : 0), 0)
  const matches = totals && totals.audioMs === audio && totals.billableChars === billed
  return (
    <tfoot>
      <tr className={done ? '' : 'is-pending'}>
        <th colSpan={wide ? 3 : 2}>Sum of the turns</th>
        <td>{done ? `${(audio / 1000).toFixed(2)} s` : '…'}</td>
        <td>{done ? `${billed} chars` : '…'}</td>
        <td className="tts-turns__text">{sent} characters sent</td>
      </tr>
      <tr className={totals ? 'tts-turns__total' : 'is-pending'}>
        <th colSpan={wide ? 3 : 2}>SessionMetadata</th>
        <td>{totals ? `${(totals.audioMs / 1000).toFixed(2)} s` : '…'}</td>
        <td>{totals ? `${totals.billableChars} chars` : '…'}</td>
        <td className="tts-turns__text">
          {!totals
            ? 'Sent after Close, once the last turn is done.'
            : matches
              ? `Matches the sum of the turns. ${totals.inputChars} input characters.`
              : `Differs from the sum of the turns. ${totals.inputChars} input characters.`}
        </td>
      </tr>
    </tfoot>
  )
}

// A callback run: the request_id at once, then the wait, then what the webhook brought.
function CallbackCard({ cb, done, seconds }: { cb: CallbackRun; done: boolean; seconds?: number }) {
  if (cb.local) {
    return (
      <p className="hint">
        This server runs on your machine, so Deepgram cannot reach the webhook at <code>{cb.callback}</code> and would refuse
        the request. Nothing was sent. The deployed page passes its own public address; to try the whole trip from here, start
        the server with <code>PUBLIC_URL</code> set to a public address that reaches it.
      </p>
    )
  }
  return (
    <>
      {!done && (
        <div className="tts-wait" role="status">
          <p className="hint">
            {!cb.requestId
              ? 'Sending the request…'
              : cb.waitedS
                ? `Deepgram answered with a request_id and no audio. Waiting for the webhook: ${cb.waitedS} s…`
                : 'Deepgram answered with a request_id and no audio. Waiting for the webhook…'}
            {cb.textFetchedMs !== undefined && ` Deepgram fetched the text after ${(cb.textFetchedMs / 1000).toFixed(1)} s.`}
          </p>
          <div className="tts-wait__bar" aria-hidden="true">
            <span />
          </div>
        </div>
      )}
      <dl className="tts-stats">
        <dt>Answered (request_id)</dt>
        <dd>{cb.acceptedMs === undefined ? '…' : ms(cb.acceptedMs)}</dd>
        {cb.textFetchedMs !== undefined && (
          <>
            <dt>Text fetched after</dt>
            <dd>{(cb.textFetchedMs / 1000).toFixed(1)} s</dd>
          </>
        )}
        <dt>Audio delivered after</dt>
        <dd>{cb.afterMs === undefined ? '…' : `${(cb.afterMs / 1000).toFixed(1)} s`}</dd>
        <dt>Delivered by</dt>
        <dd>{cb.method ?? '…'}</dd>
        <dt>Audio</dt>
        <dd>{seconds === undefined ? '…' : `${seconds.toFixed(1)} s, ${Math.round((cb.bytes ?? 0) / 1024)} KB`}</dd>
      </dl>
    </>
  )
}
