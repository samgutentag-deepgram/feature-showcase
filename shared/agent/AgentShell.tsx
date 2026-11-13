// The page every voice agent demo shares: pick the listen model, set the feature, press Start and
// talk. The mic streams to the Agent API, the agent's audio plays back, and every event lands in a
// timeline. The last two conversations stay side by side.
import { useEffect, useRef, useState } from 'react'
import { startCapture, type Capture } from '../common/capture'
import { MAX_SECONDS, clock, fetchToken } from '../common/config'
import type { Json } from '../common/feature'
import { LINKS, dgLink, type Button, type Placement } from '../common/links'
import { pcm16ToFloat } from '../tts/speak'
import { AGENT_URL, LISTEN_MODELS, OUTPUT_RATE, settingsMessage, type AgentFeature } from './feature'
import './agent.css'
import { TakeHome } from '../common/TakeHome'

type Status = 'idle' | 'connecting' | 'mic' | 'live'

interface Event {
  ms: number
  type: string
  detail?: string
}

interface Run {
  id: number
  label: string
  lines: Array<{ role: string; content: string; behavior?: string; sent?: string }>
  events: Event[]
}

// What a mid-call button shows after a click: waiting, then what the server did and how fast.
interface Fired {
  kind: 'wait' | 'ok' | 'warn'
  note: string
}

// Messages too chatty for the timeline.
const QUIET = new Set(['History', 'LatencyReport'])

export function AgentShell<S>({ feature }: { feature: AgentFeature<S> }) {
  const [state, setState] = useState<S>(feature.initialState)
  const [listen, setListen] = useState(LISTEN_MODELS[0].id)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [runs, setRuns] = useState<Run[]>([])
  const [lastEvent, setLastEvent] = useState<Json | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [fired, setFired] = useState<Record<string, Fired>>({})
  const clearFired = useRef<Record<string, number>>({})

  const ws = useRef<WebSocket | null>(null)
  const capture = useRef<Capture | null>(null)
  const out = useRef<AudioContext | null>(null)
  const sources = useRef<AudioBufferSourceNode[]>([])
  // Agent audio goes through this, so a mid-call button can fade the old reply out instead of
  // cutting it dead. Each fade swaps in a fresh one for the audio that follows.
  const bus = useRef<GainNode | null>(null)
  const next = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  // Bumped by every start and stop, so a start that is still awaiting can tell it was cancelled.
  const generation = useRef(0)
  const busy = status !== 'idle'
  const link = (href: string, placement: Placement, button: Button) => dgLink(href, placement, button)
  const settings = settingsMessage(feature, state, listen)
  const actions = feature.actions?.(state) ?? []
  // Set while a conversation is live, so the mid-call buttons can log to the current run.
  const send = useRef<((a: (typeof actions)[number]) => void) | null>(null)
  const showFired = (label: string, f: Fired | null) => {
    window.clearTimeout(clearFired.current[label])
    setFired((all) => {
      const next = { ...all }
      if (f) next[label] = f
      else delete next[label]
      return next
    })
    if (f && f.kind !== 'wait') clearFired.current[label] = window.setTimeout(() => showFired(label, null), 4000)
  }

  // Stops every queued chunk of agent audio. Returns how many seconds were still to play.
  // Stops every queued chunk of agent audio. Returns how many seconds were still to play. With a
  // fade, the old audio ramps down over that many seconds and new audio starts once it is quiet.
  const flush = (fade = 0) => {
    const ctx = out.current
    const left = ctx ? Math.max(0, next.current - ctx.currentTime) : 0
    const old = sources.current
    sources.current = []
    next.current = 0
    if (ctx && fade > 0 && bus.current && left > 0) {
      const g = bus.current.gain
      g.setValueAtTime(g.value, ctx.currentTime)
      g.linearRampToValueAtTime(0, ctx.currentTime + fade)
      const faded = bus.current
      window.setTimeout(() => faded.disconnect(), fade * 1000 + 100)
      bus.current = null
      next.current = ctx.currentTime + fade
    }
    for (const s of old) {
      try {
        s.stop(ctx && fade > 0 && left > 0 ? ctx.currentTime + fade : 0)
      } catch {
        // Already stopped.
      }
    }
    return left
  }

  const stop = () => {
    generation.current++
    send.current = null
    setFired({})
    window.clearInterval(timer.current)
    capture.current?.stop()
    capture.current = null
    const s = ws.current
    ws.current = null
    if (s && s.readyState <= 1) s.close()
    flush()
    setStatus('idle')
  }

  useEffect(() => () => stop(), [])

  const start = async () => {
    const gen = ++generation.current
    const current = () => gen === generation.current
    setError('')
    setLastEvent(null)
    const ctx = out.current ?? new AudioContext()
    out.current = ctx
    await ctx.resume()
    const id = (runs[0]?.id ?? 0) + 1
    const label = `${LISTEN_MODELS.find((m) => m.id === listen)?.label}, ${feature.runLabel(state)}`
    setRuns((rs) => [{ id, label, lines: [], events: [] }, ...rs].slice(0, 2))
    const add = (e: Omit<Event, 'ms'>) =>
      setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, events: [...r.events, { ...e, ms: performance.now() - t0 }] } : r)))
    const say = (role: string, content: string, behavior?: string, sent?: string) =>
      setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, lines: [...r.lines, { role, content, behavior, sent }] } : r)))
    const runState = state
    const t0 = performance.now()
    // Clicks still waiting on the server. A ConversationText only answers a click if it speaks the
    // line the click sent, so the agent's own replies do not count.
    let pending: Array<{ label: string; ack: string[]; line?: string; then?: Json; at: number }> = []
    const lineOf = (msg: Json) => {
      const line = msg.message ?? msg.content
      return typeof line === 'string' ? line : undefined
    }
    setElapsed(0)

    // Mic first, then connect: the agent waits for audio before it greets, so the mic has to be
    // live the moment the session is. Audio is held back until Settings is applied.
    let ready = false
    let socket: WebSocket | null = null
    setStatus('mic')
    try {
      const cap = await startCapture({ kind: 'mic' }, (pcm) => ready && socket?.readyState === 1 && socket.send(pcm), () => {})
      if (!current()) {
        cap.stop()
        return
      }
      capture.current = cap
    } catch (err) {
      if (!current()) return
      const name = (err as Error).name
      setError(name === 'NotAllowedError' ? 'Microphone access was blocked. Allow it in the address bar and try again.' : (err as Error).message)
      stop()
      return
    }
    setStatus('connecting')

    let token: string
    try {
      token = await fetchToken()
    } catch (err) {
      if (current()) {
        setError((err as Error).message)
        setStatus('idle')
      }
      return
    }
    if (!current()) return

    const sock = new WebSocket(AGENT_URL, ['bearer', token])
    socket = sock
    sock.binaryType = 'arraybuffer'
    ws.current = sock

    sock.onopen = () => sock.send(JSON.stringify(settings))
    sock.onerror = () => setError('Lost the connection to Deepgram. Try again.')
    sock.onclose = (e) => {
      if (ws.current === sock && e.code !== 1000 && e.code !== 1005) setError(`The agent connection closed early. Try again. (${e.code}${e.reason ? `: ${e.reason}` : ''})`)
      if (ws.current === sock) stop()
    }
    sock.onmessage = (e) => {
      if (typeof e.data !== 'string') {
        // Agent speech: 16-bit PCM at 24 kHz, queued back to back.
        const samples = pcm16ToFloat(new Uint8Array(e.data as ArrayBuffer))
        if (!samples.length) return
        const buf = ctx.createBuffer(1, samples.length, OUTPUT_RATE)
        buf.copyToChannel(samples, 0)
        const src = ctx.createBufferSource()
        src.buffer = buf
        if (!bus.current) {
          bus.current = ctx.createGain()
          bus.current.connect(ctx.destination)
        }
        src.connect(bus.current)
        next.current = Math.max(next.current, ctx.currentTime + 0.03)
        src.start(next.current)
        next.current += buf.duration
        sources.current.push(src)
        src.onended = () => (sources.current = sources.current.filter((s) => s !== src))
        return
      }
      const m = JSON.parse(e.data as string) as Json
      const type = String(m.type)
      // Think Live tags its own lines: "ConversationText backchannel", "ConversationText presence_check".
      const behavior = type === 'ConversationText' && m.conversational_behavior && m.conversational_behavior !== 'default' ? String(m.conversational_behavior) : ''
      const label = behavior ? `${type} ${behavior}` : type
      const hit = pending.find((p) => p.ack.includes(type) && (type !== 'ConversationText' || !p.line || m.content === p.line))
      if (hit) {
        pending = pending.filter((p) => p !== hit)
        const secs = `${((performance.now() - hit.at) / 1000).toFixed(1)} s`
        const failed = type === 'Warning' || type === 'Error'
        showFired(hit.label, failed ? { kind: 'warn', note: `${String(m.code ?? type)}, ${secs}` } : { kind: 'ok', note: `${type}, ${secs}` })
        if (!failed && hit.then && sock.readyState === 1) {
          if (hit.then.behavior === 'interrupt') flush(0.25)
          sock.send(JSON.stringify(hit.then))
          add({ type: `${String(hit.then.type)} (sent)`, detail: `${hit.label}, after ${type}` })
          pending = [...pending, { label: hit.label, ack: ['ConversationText'], line: lineOf(hit.then), at: performance.now() }]
        }
      }
      if (feature.events.includes(type) || feature.events.includes(label) || type === 'Error') setLastEvent(m)
      if (type === 'SettingsApplied') {
        add({ type })
        ready = true
        setStatus('live')
        send.current = (a) => {
          if (sock.readyState !== 1) return
          const left = a.flush ? flush(0.25) : 0
          sock.send(JSON.stringify(a.message))
          pending = [...pending.filter((p) => p.label !== a.label), { label: a.label, ack: a.ack, line: lineOf(a.message), then: a.then, at: performance.now() }]
          showFired(a.label, { kind: 'wait', note: 'sent, waiting' })
          add({ type: `${String(a.message.type)} (sent)`, detail: [a.label, left > 0.05 ? `${left.toFixed(1)} s of queued audio dropped` : ''].filter(Boolean).join(', ') })
        }
        const began = performance.now()
        timer.current = window.setInterval(() => {
          const s = (performance.now() - began) / 1000
          setElapsed(s)
          if (s >= MAX_SECONDS) stop()
        }, 250)
        return
      }
      if (type === 'ConversationText') {
        // A line a button put in the agent's mouth is tagged with that button.
        say(String(m.role), String(m.content), behavior || undefined, type === 'ConversationText' && hit ? hit.label : undefined)
        if (behavior) add({ type: label, detail: String(m.content) })
        return
      }
      if (type === 'Warning') {
        add({ type, detail: [m.code, m.description].filter(Boolean).join(': ') })
        return
      }
      if (type === 'UserStartedSpeaking') {
        if (feature.flushOnUserSpeech(runState)) {
          const left = flush()
          add({ type, detail: left > 0.05 ? `stopped the agent: ${left.toFixed(1)} s of its audio dropped` : 'agent was not talking' })
        } else {
          const left = out.current ? Math.max(0, next.current - out.current.currentTime) : 0
          add({ type, detail: left > 0.05 ? `ignored: the agent keeps talking for ${left.toFixed(1)} s` : 'agent was not talking' })
        }
        return
      }
      if (type === 'FunctionCallRequest') {
        for (const f of (m.functions as Json[] | undefined) ?? []) {
          add({ type, detail: `${String(f.name)}(${String(f.arguments)})` })
          if (f.client_side === false || !feature.onFunctionCall) continue
          let args: Json = {}
          try {
            args = JSON.parse(String(f.arguments)) as Json
          } catch {
            // Send the call back with empty arguments; the agent will say it could not look it up.
          }
          const content = JSON.stringify(feature.onFunctionCall(String(f.name), args, runState))
          const reply = { type: 'FunctionCallResponse', id: f.id, name: f.name, content }
          sock.send(JSON.stringify(reply))
          add({ type: 'FunctionCallResponse (sent)', detail: content })
        }
        return
      }
      if (type === 'Error') {
        setError(`The agent reported an error: ${String(m.description ?? m.message ?? 'no details')}`)
        add({ type, detail: String(m.description ?? '') })
        return
      }
      if (!QUIET.has(type)) add({ type })
    }
  }

  const json = JSON.stringify(settings, null, 2).split('\n')
  const marked = (line: string) => feature.highlight.some((k) => line.includes(`"${k}"`))
  const { Controls } = feature
  const phrases = feature.phrases(state)

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
          <span className="agent-listen">Listen model</span>
          <div className="segmented" role="radiogroup" aria-label="Listen model">
            {LISTEN_MODELS.map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={listen === m.id}
                className={listen === m.id ? 'segmented__opt is-on' : 'segmented__opt'}
                disabled={busy}
                onClick={() => setListen(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <Controls state={state} setState={setState} busy={busy} />

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

        <p className="hint">Headphones help: without them the agent can hear itself through your speakers.</p>

        <div className="actions">
          {busy ? (
            <button className="btn btn--stop" onClick={stop}>
              <span className="dot" /> {status === 'connecting' ? 'Connecting…' : status === 'mic' ? 'Allow the mic…' : 'Stop'}
            </button>
          ) : (
            <button className="btn btn--primary" onClick={start}>
              Start talking
            </button>
          )}
          {actions.map((a) => {
            const f = fired[a.label]
            return (
              <button
                key={a.label}
                className={`btn ${a.primary ? 'btn--primary' : 'btn--ghost'} agent-action${f ? ` is-${f.kind}` : ''}`}
                disabled={status !== 'live'}
                onClick={() => send.current?.(a)}
              >
                {a.label}
                {f && <span className="agent-action__note" aria-live="polite">{f.note}</span>}
              </button>
            )
          })}
          <span className="timer" aria-label="Elapsed">
            {clock(elapsed)} / {clock(MAX_SECONDS)}
          </span>
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        <div className="wire">
          <div className="wire__block">
            <span className="wire__label">Request: {new URL(AGENT_URL).pathname}, first message</span>
            <pre className="agent-json">
              {json.map((line, i) => (
                <span key={i} className="agent-json__line">
                  {marked(line) ? <mark>{line}</mark> : line}
                  {'\n'}
                </span>
              ))}
            </pre>
            {actions.length > 0 && (
              <>
                <span className="wire__label">Then, mid-call, one per button</span>
                <pre className="agent-json">
                  {actions.map((a) => (
                    <span key={a.label} className="agent-json__line">
                      <mark>{JSON.stringify(a.message)}</mark>
                      {'\n'}
                      {a.then && (
                        <>
                          <mark>{JSON.stringify(a.then)}</mark>
                          {'\n'}
                        </>
                      )}
                    </span>
                  ))}
                </pre>
              </>
            )}
          </div>
          <div className="wire__block">
            <span className="wire__label">Response: last {feature.events.join(' or ')}</span>
            <code>
              {lastEvent ? (
                <span className="wire__part wire__part--text">
                  <mark>{JSON.stringify(lastEvent).slice(0, 400)}</mark>
                </span>
              ) : (
                <span className="wire__key">Shows up here when it happens.</span>
              )}
            </code>
          </div>
        </div>
        <TakeHome />
      </section>

      {runs.length > 0 && (
        <div className={runs.length > 1 ? 'runs runs--compare' : 'runs'}>
          {[...runs].reverse().map((r) => (
            <section className="panel agent-run" key={r.id}>
              <header className="run__head">
                <span className="run__num">Run {r.id}</span>
                <span className="run__label">{r.label}</span>
              </header>
              <div className="agent-lines">
                {r.lines.map((l, i) => (
                  <p key={i} className={`agent-line agent-line--${l.role}${l.behavior ? ' agent-line--aside' : ''}`}>
                    <span className="agent-line__who">{l.role === 'user' ? 'You' : 'Agent'}</span>
                    {l.behavior && <span className="agent-line__tag">{l.behavior.replace('_', ' ')}</span>}
                    {l.sent && <span className="agent-line__tag agent-line__tag--sent">{l.sent}</span>} {l.content}
                  </p>
                ))}
              </div>
              <ol className="agent-events" aria-label="Events">
                {r.events.map((e, i) => (
                  <li key={i} className={feature.events.some((t) => e.type.startsWith(t)) ? 'is-marked' : ''}>
                    <span className="agent-events__ms">{(e.ms / 1000).toFixed(1)} s</span>
                    <span className="agent-events__type">{e.type}</span>
                    {e.detail && <span className="agent-events__detail">{e.detail}</span>}
                  </li>
                ))}
              </ol>
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
