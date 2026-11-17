// The page every LLM-kind demo shares: Audio and Text Intelligence (/v1/listen, /v1/read) and
// Deepgram LLMs (/v1/think). The visitor speaks (recorded, then sent once), plays a bundled clip, or
// types; sends one request; and sees the Request card built from the same plan() that is sent, the
// fields that matter in the Response card, and the result.
import { useEffect, useRef, useState } from 'react'
import './llm.css'
import { startCapture, type Capture } from '../common/capture'
import { MAX_SECONDS, SAMPLE_RATE, clock, fetchToken } from '../common/config'
import { LINKS, dgLink, sourceLink, type Button, type Placement } from '../common/links'
import { TakeHome } from '../common/TakeHome'
import type { Json } from '../common/feature'
import type { Lane, LlmFeature, LlmInput, LlmRun, Planned } from './feature'
import { MIC_AUDIO, audioType, plan, RequestError, runThinkLane, sendOnce, thinkBodies, wav, type AudioInfo, type Auth } from './request'
import { callbackShown, openSlot, unreachable, waitForDelivery } from './callback'
import { AnalysisView, DefaultResponse, ThinkView } from './Results'

type Status = 'idle' | 'recording' | 'sending'

// A fresh granted token per request, as `Authorization: Bearer`.
const bearer: Auth = async () => `Bearer ${await fetchToken()}`

// The query part of a request line, one entry per param, so the card wraps between params.
function RequestLine({ line, highlight }: { line: string; highlight: string[] }) {
  const [head, query] = line.split('?')
  const parts = query ? query.split('&') : []
  const marked = (p: string) => highlight.some((k) => p.startsWith(`${k}=`))
  return (
    <>
      <span className="wire__part">{head}</span>
      {parts.map((p, i) => (
        <span className="wire__part" key={i}>
          {i === 0 ? '?' : '&'}
          {marked(p) ? <mark>{p}</mark> : p}
        </span>
      ))}
    </>
  )
}

// A pretty JSON body, with every line of a highlighted top-level key marked.
function RequestBody({ body, highlight }: { body: string; highlight: string[] }) {
  let current = ''
  return (
    <span className="llm-body">
      {body.split('\n').map((line, i) => {
        const top = line.match(/^ {2}"(\w+)":/)
        if (top) current = top[1]
        else if (!line.startsWith('   ')) current = ''
        const text = `${line}\n`
        return highlight.includes(current) ? <mark key={i}>{text}</mark> : <span key={i}>{text}</span>
      })}
    </span>
  )
}

export function LlmShell<S>({ feature }: { feature: LlmFeature<S> }) {
  const [inputId, setInputId] = useState(feature.inputs[0].id)
  const [state, setState] = useState<S>(feature.initialState)
  const [text, setText] = useState(() => feature.texts(feature.initialState)[0] ?? '')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [runs, setRuns] = useState<LlmRun<S>[]>([])
  const [elapsed, setElapsed] = useState(0)

  const capture = useRef<Capture | null>(null)
  const chunks = useRef<ArrayBuffer[]>([])
  const timer = useRef<number | undefined>(undefined)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      window.clearInterval(timer.current)
      capture.current?.stop()
    }
  }, [])

  const input: LlmInput = feature.inputs.find((i) => i.id === inputId) ?? feature.inputs[0]
  const busy = status !== 'idle'
  const sample = feature.sample
  const audio: AudioInfo = input.source === 'sample' && sample ? { note: `the sample clip: ${sample.label}`, type: audioType(sample.url) } : MIC_AUDIO
  const sent = input.source === 'sample' ? sample?.script ?? '' : text
  const callback = feature.api === 'intelligence' && feature.callback && input.source === 'text'
  const planned = plan(feature, state, input.source, sent, { audio, callback: callback ? callbackShown() : undefined })
  const latest = runs[0]
  // After a run, the card shows what that run sent (tool follow-ups, the real callback URL) while
  // nothing has changed since; otherwise what the next run will send.
  const same = latest && latest.state === state && latest.input.id === input.id && (input.source !== 'text' || latest.text === text)
  const shown: Planned[] = same ? latest.lanes.flatMap((l) => l.exchanges.map((e) => e.request)) : []
  const cards = shown.length ? shown : planned
  const link = (href: string, placement: Placement, button: Button) => dgLink(href, placement, button)

  const updateLane = (runId: number, i: number, lane: Lane) => {
    if (!alive.current) return
    setRuns((rs) => rs.map((r) => (r.id === runId ? { ...r, lanes: r.lanes.map((l, j) => (j === i ? lane : l)) } : r)))
  }

  const startRun = (label: string): LlmRun<S> => {
    const id = (runs[0]?.id ?? 0) + 1
    const lanes: Lane[] =
      feature.api === 'think'
        ? thinkBodies(feature, state, sent).map((b) => ({ title: b.model, exchanges: [], status: 'running' }))
        : [{ title: 'intelligence', exchanges: [], status: 'running' }]
    const run: LlmRun<S> = { id, label: `${feature.runLabel(state)}${label}`, input, state, text: input.source === 'mic' ? '' : sent, lanes }
    setRuns((rs) => (feature.compare ? [run, ...rs].slice(0, 2) : [run]))
    return run
  }

  const fail = (run: LlmRun<S>, i: number, err: unknown) => {
    const message = err instanceof RequestError || err instanceof Error ? err.message : 'Something went wrong. Try again.'
    updateLane(run.id, i, { ...run.lanes[i], status: 'error', error: message })
    if (err instanceof RequestError && err.detail) console.warn('deepgram', err.status, err.detail)
  }

  async function sendIntelligence(run: LlmRun<S>, body?: BodyInit) {
    if (feature.api !== 'intelligence') return
    const lane = run.lanes[0]
    try {
      if (callback) {
        const slot = await openSlot()
        if (unreachable(slot.callback)) throw new Error('Deepgram cannot reach a callback on this machine. Run with PUBLIC_URL set to a public tunnel.')
        const [req] = plan(feature, state, 'text', sent, { callback: slot.callback })
        const ex = await sendOnce(req, bearer)
        const requestId = String((ex.json as Json).request_id ?? '')
        const waiting: Lane = { ...lane, exchanges: [ex], callback: { requestId, acceptedMs: ex.ms } }
        updateLane(run.id, 0, waiting)
        const d = await waitForDelivery(slot.id, () => !alive.current)
        updateLane(run.id, 0, {
          ...waiting,
          status: 'done',
          exchanges: [ex, { ...ex, json: d.body, ms: d.afterMs }],
          callback: { requestId, acceptedMs: ex.ms, afterMs: d.afterMs, method: d.method },
        })
        return
      }
      const [req] = plan(feature, state, input.source, sent, { audio })
      const ex = await sendOnce(req, bearer, body)
      updateLane(run.id, 0, { ...lane, status: 'done', exchanges: [ex] })
    } catch (err) {
      fail(run, 0, err)
    }
  }

  async function sendThink(run: LlmRun<S>) {
    if (feature.api !== 'think') return
    await Promise.all(
      thinkBodies(feature, state, sent).map(async (body, i) => {
        try {
          await runThinkLane(feature, state, body, bearer, (lane) => updateLane(run.id, i, lane))
        } catch (err) {
          fail(run, i, err)
        }
      }),
    )
  }

  const send = async () => {
    setError('')
    if (input.source === 'text' && !text.trim()) return setError('Type something to send first.')
    setStatus('sending')
    try {
      const run = startRun('')
      if (feature.api === 'think') await sendThink(run)
      else if (input.source === 'sample' && sample) {
        const res = await fetch(sample.url)
        if (!res.ok) throw new Error('The sample clip did not load. Reload the page and try again.')
        await sendIntelligence(run, await res.blob())
      } else await sendIntelligence(run)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      if (alive.current) setStatus('idle')
    }
  }

  // Mic: record until Stop (or MAX_SECONDS), then send the recording once.
  const startMic = async () => {
    setError('')
    chunks.current = []
    setElapsed(0)
    try {
      capture.current = await startCapture({ kind: 'mic' }, (pcm) => chunks.current.push(pcm), () => {})
      const t0 = performance.now()
      timer.current = window.setInterval(() => {
        const s = (performance.now() - t0) / 1000
        setElapsed(s)
        if (s >= MAX_SECONDS) void stopMic()
      }, 250)
      setStatus('recording')
    } catch (err) {
      setError(micError(err as Error))
    }
  }

  const stopMic = async () => {
    window.clearInterval(timer.current)
    capture.current?.stop()
    capture.current = null
    const pcm = chunks.current
    chunks.current = []
    const bytes = pcm.reduce((n, c) => n + c.byteLength, 0)
    if (bytes < SAMPLE_RATE) {
      setStatus('idle')
      return setError('That was under half a second of audio. Press Start mic and read the phrase.')
    }
    setStatus('sending')
    const run = startRun(`, ${clock(bytes / 2 / SAMPLE_RATE)} of mic audio`)
    await sendIntelligence(run, new Blob([wav(pcm, SAMPLE_RATE)], { type: 'audio/wav' }))
    if (alive.current) setStatus('idle')
  }

  const switchInput = (id: string) => {
    setInputId(id)
    setError('')
  }

  const setFeatureState = (next: S) => {
    setState(next)
    // Keep a typed text; swap in the new suggestion only when the box still holds an old one.
    if (feature.texts(state).includes(text)) setText(feature.texts(next)[0] ?? text)
  }

  const phrases = input.source === 'mic' ? feature.phrases?.(state) ?? [] : []
  const chips = feature.texts(state)
  const { Controls } = feature
  const Response = feature.Response ?? DefaultResponse
  const Result = feature.Result
  const view = (run: LlmRun<S>) =>
    Result ? <Result state={state} run={run} /> : feature.api === 'think' ? <ThinkView run={run as LlmRun<unknown>} /> : <AnalysisView run={run as LlmRun<unknown>} />

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
        {feature.inputs.length > 1 && (
          <div className="toolbar">
            <div className="tabs" role="tablist" aria-label="Input">
              {feature.inputs.map((m) => (
                <button
                  key={m.id}
                  role="tab"
                  aria-selected={input.id === m.id}
                  className={input.id === m.id ? 'tabs__tab is-on' : 'tabs__tab'}
                  disabled={busy}
                  onClick={() => switchInput(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {input.source === 'text' && (
          <>
            <label className="llm-text">
              <span className="llm-text__label">{feature.api === 'think' ? 'Message' : 'Text to analyze'}</span>
              <textarea value={text} rows={feature.api === 'think' ? 2 : 5} disabled={busy} onChange={(e) => setText(e.target.value)} />
            </label>
            {chips.length > 1 && (
              <div className="llm-chips" aria-label="Texts to try">
                {chips.map((p) => (
                  <button key={p} className="llm-chip" disabled={busy} onClick={() => setText(p)}>
                    {p.length > 48 ? `${p.slice(0, 46)}…` : p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {input.source === 'sample' && sample && (
          <div className="llm-sample">
            <span className="llm-text__label">Sample clip, bundled with this page: {sample.label}</span>
            <audio controls preload="none" src={sample.url} />
            <p className="note">{sample.script}</p>
          </div>
        )}

        <Controls state={state} setState={setFeatureState} busy={busy} />

        {phrases.length > 0 && (
          <div className="phrase">
            <span className="phrase__label">Try saying</span>
            {phrases.map((line, i) => (
              <p className="phrase__line" key={i}>
                {line}
              </p>
            ))}
          </div>
        )}

        <div className="actions">
          {input.source === 'mic' ? (
            status === 'recording' ? (
              <button className="btn btn--stop" onClick={() => void stopMic()}>
                <span className="dot" /> Stop and send
              </button>
            ) : (
              <button className="btn btn--primary" disabled={busy} onClick={() => void startMic()}>
                {status === 'sending' ? 'Sending…' : 'Start mic'}
              </button>
            )
          ) : (
            <button className="btn btn--primary" disabled={busy} onClick={() => void send()}>
              {status === 'sending' ? 'Sending…' : 'Send'}
            </button>
          )}
          {input.source === 'mic' && (
            <span className="timer" aria-label="Elapsed">
              {clock(elapsed)} / {clock(MAX_SECONDS)}
            </span>
          )}
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        <div className="wire">
          {cards.map((req, i) => (
            <div className="wire__block" key={i}>
              <span className="wire__label">{cards.length > 1 ? `Request ${i + 1}` : 'Request'}</span>
              <code>
                <RequestLine line={req.shown.line} highlight={feature.highlight} />
                <RequestBody body={req.shown.body} highlight={feature.highlight} />
              </code>
            </div>
          ))}
          <div className="wire__block">
            <span className="wire__label">Response</span>
            <code>
              <Response state={state} latest={latest} />
            </code>
          </div>
        </div>
        <TakeHome />
      </section>

      {runs.length === 0 ? (
        <section className="panel panel--transcript">
          {Result ? <Result state={state} /> : <p className="llm-said llm-said--muted">Your result shows up here.</p>}
        </section>
      ) : (
        <div className={runs.length > 1 ? 'runs runs--compare' : 'runs'}>
          {[...runs].reverse().map((r) => (
            <section className="panel panel--transcript" key={r.id}>
              {(feature.compare || runs.length > 1) && (
                <header className="run__head">
                  <span className="run__num">Run {r.id}</span>
                  <span className="run__label">{r.label}</span>
                  {r.lanes.some((l) => l.status === 'running') && <span className="dot" aria-label="Running" />}
                </header>
              )}
              {view(r)}
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
        {feature.links.changelog && <a href={link(feature.links.changelog, 'footer', 'changelog')}>Changelog</a>}
        <a href={link(feature.links.docs, 'footer', 'docs')}>Docs</a>
        <a href={link(LINKS.playground, 'footer', 'playground')}>Playground</a>
        <a href={LINKS.discord}>Discord</a>
        <a href={sourceLink()}>View source</a>
        <a href={link(LINKS.signup, 'footer', 'signup')}>Get an API key</a>
      </footer>
    </main>
  )
}

function micError(e: Error): string {
  if (e.name === 'NotAllowedError') return 'Microphone access was blocked. Allow it in the address bar and try again.'
  if (e.name === 'NotFoundError') return 'No microphone was found. Plug one in and try again.'
  return e.message || 'Could not start the mic. Try again.'
}
