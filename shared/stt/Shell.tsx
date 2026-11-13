// The page every demo shares: masthead, hero, mode tabs, model toggle, mic or file capture, the
// Request and Response cards, the runs, the call to action. The feature fills in the rest.
import { useCallback, useEffect, useRef, useState, type DragEvent as ReactDragEvent } from 'react'
import { readDuration, startCapture, type Capture, type Source } from '../common/capture'
import { MAX_SECONDS, MAX_UPLOAD_BYTES, clock, describeRequest, formatMB } from '../common/config'
import type { Ctx, Feature, Run } from '../common/feature'
import { LimitDialog } from './LimitDialog'
import { LINKS, dgLink, sourceLink, type Button, type Placement } from '../common/links'
import { openStream, type Stream } from './stream'
import { TakeHome } from '../common/TakeHome'

type Status = 'idle' | 'connecting' | 'live' | 'finishing'

interface LoadedFile {
  file: File
  seconds: number
}

export function Shell<S>({ feature }: { feature: Feature<S> }) {
  const [modeId, setModeId] = useState(feature.modes[0].id)
  const [modelId, setModelId] = useState(feature.models[0].id)
  const [state, setState] = useState<S>(feature.initialState)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [runs, setRuns] = useState<Run<S>[]>([])
  const [loaded, setLoaded] = useState<LoadedFile | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [tooBig, setTooBig] = useState<string | null>(null)

  const stream = useRef<Stream | null>(null)
  const capture = useRef<Capture | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const fileInput = useRef<HTMLInputElement>(null)

  const busy = status !== 'idle'
  const model = feature.models.find((m) => m.id === modelId) ?? feature.models[0]
  const mode = feature.modes.find((m) => m.id === modeId) ?? feature.modes[0]
  const ctx: Ctx = { model, mode, busy }
  const isFile = mode.source === 'file'
  const compare = mode.compare ?? isFile
  const phrases = !isFile ? feature.phrases?.(state, ctx) ?? [] : []
  // The newest run is the one streaming whenever a session is open.
  const activeRun = busy ? runs[0]?.id : undefined
  const link = (href: string, placement: Placement, button: Button) => dgLink(href, placement, button)

  const stopCapture = useCallback(() => {
    window.clearInterval(timer.current)
    capture.current?.stop()
    capture.current = null
  }, [])

  const teardown = useCallback(() => {
    stopCapture()
    const s = stream.current
    stream.current = null
    s?.close()
  }, [stopCapture])

  useEffect(() => teardown, [teardown])

  // A file dropped anywhere outside the zone would otherwise replace the page with the file.
  useEffect(() => {
    const block = (e: DragEvent) => e.preventDefault()
    window.addEventListener('dragover', block)
    window.addEventListener('drop', block)
    return () => {
      window.removeEventListener('dragover', block)
      window.removeEventListener('drop', block)
    }
  }, [])

  const finish = useCallback(() => {
    stopCapture()
    const s = stream.current
    if (!s) return
    setStatus('finishing')
    s.finish()
    // If Deepgram never closes the socket, close it ourselves. close() still fires onClose.
    window.setTimeout(() => s.close(), 5000)
  }, [stopCapture])

  const updateRun = (id: number, fn: (r: Run<S>) => Run<S>) =>
    setRuns((rs) => rs.map((r) => (r.id === id ? fn(r) : r)))

  // Checks a file and holds it. Nothing is sent until Run is pressed.
  const loadFile = async (file: File) => {
    setError('')
    if (file.type && !file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
      setError(`${file.name} is not an audio file. Try an MP3, WAV, or M4A.`)
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setTooBig(`That file is ${formatMB(file.size)}.`)
      return
    }
    try {
      const seconds = await readDuration(file)
      // Half a second of slack so a clip trimmed to exactly a minute still fits.
      if (Number.isFinite(seconds) && seconds > MAX_SECONDS + 0.5) {
        setTooBig(`That clip runs ${clock(seconds)}.`)
        return
      }
      setLoaded({ file, seconds: Number.isFinite(seconds) ? seconds : 0 })
      // A new file starts a new comparison.
      setRuns([])
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const endRun = () => {
    teardown()
    setStatus('idle')
  }

  const start = async (src: Source) => {
    setError('')
    const id = (runs[0]?.id ?? 0) + 1
    const label = `${model.label}, ${feature.runLabel(state, ctx)}`
    const run: Run<S> = { id, label, model, mode, state, committed: [], pending: [], echoed: undefined }
    // Compare modes keep the previous run beside the new one; the others start fresh.
    setRuns((rs) => (compare ? [run, ...rs].slice(0, 2) : [run]))
    setElapsed(0)
    setStatus('connecting')

    try {
      stream.current = await openStream(model, feature.params(state, ctx), {
        onUpdate(u) {
          const echoed = feature.echo?.(u.raw, model)
          updateRun(id, (r) => ({
            ...r,
            echoed: echoed ?? r.echoed,
            committed: u.final ? [...r.committed, ...u.words] : r.committed,
            pending: u.final ? [] : u.words.map((w) => ({ ...w, pending: true })),
          }))
        },
        onError(message) {
          setError(message)
        },
        onClose() {
          // Whatever was still interim when the socket closed is the best we have. Keep it.
          updateRun(id, (r) => ({
            ...r,
            committed: [...r.committed, ...r.pending.map((w) => ({ ...w, pending: false }))],
            pending: [],
          }))
          endRun()
        },
      })

      capture.current = await startCapture(src, (pcm) => stream.current?.send(pcm), finish)
      const startedAt = performance.now()
      timer.current = window.setInterval(() => {
        const audio = capture.current?.audio
        const s = audio ? audio.currentTime : (performance.now() - startedAt) / 1000
        setElapsed(s)
        if (s >= MAX_SECONDS) finish()
      }, 250)
      setStatus('live')
    } catch (err) {
      endRun()
      setError(startError(err as Error))
    }
  }

  const switchModel = (id: string) => {
    const next = feature.models.find((m) => m.id === id)
    if (!next) return
    setModelId(id)
    if (feature.onModelChange) setState(feature.onModelChange(state, next))
  }

  const switchMode = (id: string) => {
    setModeId(id)
    setRuns([])
    setError('')
  }

  const pickFile = () => fileInput.current?.click()

  // The drop zone and the loaded-file card both accept a drop.
  const dropProps = {
    // The window listeners above already preventDefault every dragover and drop.
    onDragEnter: () => {
      if (!busy) setDragOver(true)
    },
    onDragLeave: (e: ReactDragEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false)
    },
    onDrop: (e: ReactDragEvent<HTMLDivElement>) => {
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file && !busy) loadFile(file)
    },
  }

  // Path, then one entry per query param, so the card can wrap between params.
  const requestParts = describeRequest(model, feature.params(state, ctx)).split(/[?&]/)
  const marked = (part: string) => feature.highlight.some((k) => part.startsWith(`${k}=`))
  const { Controls, Response, Result } = feature

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
        <div className="toolbar">
          {feature.modes.length > 1 && (
            <div className="tabs" role="tablist" aria-label="Mode">
              {feature.modes.map((m) => (
                <button
                  key={m.id}
                  role="tab"
                  aria-selected={mode.id === m.id}
                  className={mode.id === m.id ? 'tabs__tab is-on' : 'tabs__tab'}
                  disabled={busy}
                  onClick={() => switchMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
          {feature.models.length === 1 && (
            <div className="segmented" aria-label="Model">
              <span className="segmented__opt is-on">{model.label}</span>
            </div>
          )}
          {feature.models.length > 1 && (
            <div className="segmented" role="radiogroup" aria-label="Model">
              {feature.models.map((m) => (
                <button
                  key={m.id}
                  role="radio"
                  aria-checked={model.id === m.id}
                  className={model.id === m.id ? 'segmented__opt is-on' : 'segmented__opt'}
                  disabled={busy}
                  onClick={() => switchModel(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {feature.modes.some((m) => m.source === 'file') && (
          <input
            ref={fileInput}
            type="file"
            accept="audio/*,video/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) loadFile(file)
            }}
          />
        )}

        {isFile &&
          (loaded ? (
            <div className={dragOver ? 'filecard is-over' : 'filecard'} {...dropProps}>
              <div className="filecard__info">
                <span className="filecard__name">{loaded.file.name}</span>
                <span className="filecard__meta">
                  {dragOver
                    ? 'Drop to replace'
                    : `${loaded.seconds ? `${clock(loaded.seconds)}, ` : ''}${formatMB(loaded.file.size)}`}
                </span>
              </div>
              <button className="btn btn--ghost" onClick={pickFile} disabled={busy}>
                Replace
              </button>
            </div>
          ) : (
            <div
              className={dragOver ? 'dropzone is-over' : 'dropzone'}
              role="button"
              tabIndex={0}
              onClick={pickFile}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  pickFile()
                }
              }}
              {...dropProps}
            >
              <span className="dropzone__title">{dragOver ? 'Drop to load' : 'Drop an audio file here'}</span>
              <span className="dropzone__sub">Or click to choose one.</span>
            </div>
          ))}

        <Controls state={state} setState={setState} ctx={ctx} />

        {model.note && <p className="note">{model.note}</p>}

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
          {busy ? (
            <button className="btn btn--stop" onClick={finish} disabled={status !== 'live'}>
              <span className="dot" /> {status === 'connecting' ? 'Connecting…' : status === 'finishing' ? 'Finishing…' : 'Stop'}
            </button>
          ) : isFile ? (
            <button
              className="btn btn--primary"
              disabled={!loaded}
              onClick={() => loaded && start({ kind: 'file', file: loaded.file })}
            >
              {feature.actionLabel?.(state, ctx) ?? 'Run'}
            </button>
          ) : (
            <button className="btn btn--primary" onClick={() => start({ kind: 'mic' })}>
              Start mic
            </button>
          )}
          <span className="timer" aria-label="Elapsed">
            {clock(elapsed)}
            {/* Uploads are already under the limit; only a mic run can hit it. */}
            {!isFile && ` / ${clock(MAX_SECONDS)}`}
          </span>
        </div>

        {compare && !busy && runs.length === 1 && feature.compareTip && (
          <p className="hint">{feature.compareTip(state, ctx)}</p>
        )}

        {error && <p className="error" role="alert">{error}</p>}

        <div className="wire">
          <div className="wire__block">
            <span className="wire__label">Request</span>
            <code>
              {requestParts.map((part, i) => {
                const text = i === 0 ? part : `${i === 1 ? '?' : '&'}${part}`
                return (
                  <span className="wire__part" key={i}>
                    {marked(part) ? <mark>{text}</mark> : text}
                  </span>
                )
              })}
            </code>
          </div>
          <div className="wire__block">
            <span className="wire__label">Response</span>
            <code>
              <Response state={state} ctx={ctx} latest={runs[0]} />
            </code>
          </div>
        </div>
        <TakeHome />
      </section>

      {runs.length === 0 ? (
        <section className="panel panel--transcript">
          <Result state={state} ctx={ctx} live={false} />
        </section>
      ) : (
        <div className={runs.length > 1 ? 'runs runs--compare' : 'runs'}>
          {[...runs].reverse().map((r) => (
            <section className="panel panel--transcript" key={r.id}>
              {(compare || runs.length > 1) && (
                <header className="run__head">
                  <span className="run__num">Run {r.id}</span>
                  <span className="run__label">{r.label}</span>
                  {activeRun === r.id && <span className="dot" aria-label="Running" />}
                </header>
              )}
              <Result run={r} state={state} ctx={ctx} live={activeRun === r.id && status === 'live'} />
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
      <LimitDialog reason={tooBig} onClose={() => setTooBig(null)} />
    </main>
  )
}

// A browser error, in words a visitor can act on.
function startError(e: Error): string {
  if (e.name === 'NotAllowedError') return 'Microphone access was blocked. Allow it in the address bar and try again.'
  if (e.name === 'NotFoundError') return 'No microphone was found. Plug one in and try again.'
  if (e.name === 'NotSupportedError' || e.name === 'EncodingError') return 'This browser could not play that file. Try an MP3 or WAV.'
  return e.message || 'Could not start. Try again.'
}
