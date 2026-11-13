// The page every text-to-speech demo shares: type or pick a line, pick a voice, set the feature,
// press Speak. The last two runs stay side by side with their timings and a Replay button.
// A feature with cutIn speaks over the socket instead and offers Cut in while the line plays.
import { useEffect, useRef, useState } from 'react'
import { LINKS, dgLink, type Button, type Placement } from '../common/links'
import { TakeHome } from '../common/TakeHome'
import type { Params } from '../common/feature'
import type { TtsFeature } from './feature'
import { isFlux, replay, speak, speakPath, speakQuery, voiceName, type SpeakStats } from './speak'
import { listenForTurn, type Listener } from './listen'
import { sessionUrl, speakSession, type Turn } from './session'
import { LATE_MS, speakTokens, tokenUrl, type TokenStats } from './tokens'
import { cutMessage, speakSocket, type CutStats } from './socket'
import { Spectrum } from './Spectrum'
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
  // Token mode: the reply as typed so far, and the timeline once done.
  shown?: string
  tokenStats?: TokenStats
  // Session mode: every turn on the socket, as reported.
  turns?: Turn[]
  // How the cut came: the button (or space bar), or the listener's voice, with the first word heard.
  cutBy?: 'button' | 'voice'
  cutWord?: string
  error?: string
}

const MAX_CHARS = 400
const VOICE_GROUPS = [
  { label: 'Flux', flux: true },
  { label: 'Aura-2', flux: false },
]
const ms = (n: number) => `${Math.round(n)} ms`

export function TtsShell<S>({ feature }: { feature: TtsFeature<S> }) {
  const [state, setState] = useState<S>(feature.initialState)
  // Session mode reads the controls between turns, after the click that started the run.
  const stateRef = useRef(state)
  stateRef.current = state
  const [pickedVoice, setVoice] = useState(feature.voices[0])
  // A feature can pick the voice itself (a voice browser); the picker then hides.
  const voice = feature.voiceFrom ? feature.voiceFrom(state) : pickedVoice
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
    const voice = feature.voiceFrom ? feature.voiceFrom(st) : pickedVoice
    // A feature with its own line per setting (a language) speaks that line when the pick changes it.
    const own = feature.textFor?.(st)
    const line = (own !== undefined && own !== feature.textFor?.(state) ? own : text).trim().slice(0, MAX_CHARS)
    if (!line) return
    setError('')
    stopRef.current?.()
    const { c, a } = audio()
    await c.resume()
    const id = ++lastId.current
    const file = !feature.cutIn && feature.params(st).container !== 'none'
    setRuns((rs) => [{ id, label: feature.runLabel(st), voice, state: st, text: line, file }, ...rs].slice(0, 2))
    setBusy(true)
    setCutting(false)
    try {
      const { cutIn } = feature
      if (feature.tokens) {
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
        const { buffers, turns, seconds, firstAudioMs } = await p.done
        const stats = { contentType: '', bytes: 0, firstByteMs: 0, firstAudioMs, lastByteMs: 0, seconds }
        setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, stats, buffers, turns } : r)))
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
  const query = speakQuery(voice, params).split('&')
  const marked = (part: string) => feature.highlight.some((k) => part.startsWith(`${k}=`))
  const latest = runs[0]
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
        {!feature.voiceFrom && (
        <label className="tts-voice">
          <span className="tts-text__label">Voice</span>
          <select value={voice} disabled={busy} onChange={(e) => setVoice(e.target.value)}>
            {VOICE_GROUPS.map(({ label, flux }) => {
              const vs = feature.voices.filter((v) => isFlux(v) === flux)
              return vs.length ? (
                <optgroup key={label} label={label}>
                  {vs.map((v) => (
                    <option key={v} value={v}>
                      {voiceName(v)}
                    </option>
                  ))}
                </optgroup>
              ) : null
            })}
          </select>
        </label>
        )}

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
              <span className="wire__part">{socket || feature.session || feature.tokens ? 'WSS' : 'POST'} {speakPath(voice)}</span>
              {(feature.session ? sessionPath.split('?')[1].split('&') : feature.tokens ? tokenUrl(voice, params).split('?')[1].split('&') : query).map((part, i) => {
                const t = `${i === 0 ? '?' : '&'}${part}`
                return (
                  <span className="wire__part" key={i}>
                    {marked(part) ? <mark>{t}</mark> : t}
                  </span>
                )
              })}
              {feature.tokens ? (
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
                <span className="wire__part wire__part--text tts-body">
                  <span className="wire__key">body</span> {JSON.stringify({ text: line })}
                </span>
              )}
            </code>
          </div>
          <div className="wire__block">
            <span className="wire__label">Response</span>
            <code>
              {latest?.cut?.ack ? (
                <span className="wire__part wire__part--text">
                  <mark>{JSON.stringify(ackShown(latest.cut.ack))}</mark> in {ms(latest.cut.ackMs ?? 0)}
                </span>
              ) : latest?.cut ? (
                <span className="wire__part wire__part--text">
                  <span className="wire__key">Nothing sent, so nothing back: the rest of the line kept streaming.</span>
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
                </table>
              ) : r.cut ? (
                <>
                  {r.cutBy && (
                    <p className="hint">
                      {r.cutBy === 'voice' ? `You cut in by talking${r.cutWord ? `: "${r.cutWord}"` : ''}.` : 'You pressed Cut in.'}{' '}
                      {r.cut.sent
                        ? 'The page sent Interrupt, so Deepgram stopped the old line at once.'
                        : 'Nothing told Deepgram to stop, so the reply waited behind the rest of the old line.'}
                    </p>
                  )}
                  <SpokenLine ack={r.cut.ack} />
                  <dl className="tts-stats">
                    <dt>Heard before the cut</dt>
                    <dd>{(r.cut.heardMs / 1000).toFixed(1)} s</dd>
                    <dt>Reply started after</dt>
                    <dd>{r.cut.replyFirstAudioMs === undefined ? '-' : ms(r.cut.replyFirstAudioMs)}</dd>
                    <dt>Old line thrown away</dt>
                    <dd>{(r.cut.droppedMs / 1000).toFixed(1)} s</dd>
                  </dl>
                </>
              ) : r.stats ? (
                <dl className="tts-stats">
                  <dt>First audio</dt>
                  <dd>{ms(r.stats.firstAudioMs)}</dd>
                  <dt>Last byte</dt>
                  <dd>{ms(r.stats.lastByteMs)}</dd>
                  <dt>Audio</dt>
                  <dd>{r.stats.seconds.toFixed(1)} s</dd>
                  <dt>Size</dt>
                  <dd>{(r.stats.bytes / 1024).toFixed(0)} KB</dd>
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
// expected size (16-bit audio for about 14 characters a second), held short of full until it lands.
function FileProgress<S>({ run, params }: { run: Run<S>; params: Params }) {
  const received = run.received ?? 0
  const bytesPerSec = Number(params.sample_rate ?? 24000) * (params.encoding === 'mulaw' ? 1 : 2)
  const expected = (run.text.length / 14) * bytesPerSec
  const pct = Math.min(received / expected, 0.97) * 100
  return (
    <div className="tts-file" role="status">
      <div className="tts-file__head">
        <span className="tts-file__name">speech.wav</span>
        <span className="tts-file__kb">{Math.round(received / 1024)} KB</span>
      </div>
      <div className="tts-file__bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="hint">Downloading the whole file. Nothing plays until it is all here.</p>
    </div>
  )
}
