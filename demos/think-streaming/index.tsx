// Streaming on /v1/think. One message goes out twice at the same moment, the same body except
// `stream`: false waits for one chat.completion, true reads server-sent events. The page shows when
// each lane had its first text and its whole reply, the text as it reached the page, and the usage.
// Checked with curl 2026-11-16 (Early Access, this key's project is enrolled): stream true answers
// Content-Type text/event-stream, one `data: {chat.completion.chunk}` per event, then a chunk with
// finish_reason "stop", a chunk with `choices: []` and `usage`, then `data: [DONE]`; stream true
// without stream_options.include_usage true is a 400 ("Streaming think requests must set
// `stream_options.include_usage` to `true`."). On the ~120-word default prompt, Think-Fast: first
// token 314 ms streamed vs whole reply 863 ms unstreamed (142 chunks); phoneLLM mini: 332 ms vs 721 ms
// (148 chunks). On a five-word reply the two are within a few ms.
// Verified live 2026-11-16: ONLY=think-streaming pnpm verify:live passed (both bodies on Think-Fast and phoneLLM mini, every stream ended in [DONE]); through the shell's runThinkLane on the default prompt, Think-Fast first token 310 ms streamed vs whole reply 847 ms unstreamed (142 chunks, usage in the last chunk), phoneLLM mini 242 ms vs 680 ms (135 chunks).
import { useEffect, useRef, useState } from 'react'
import { THINK_MODELS, defineLlmFeature, type Lane, type LlmRun, type ThinkBody } from '../../shared/llm/feature'
import { splitReasoning } from '../../shared/llm/request'
import './styles.css'

interface State {
  model: string
}

const LONG = 'Explain in about 120 words why a voice agent should stream its LLM reply into text-to-speech.'
const SHORT = 'Say hello in five words.'
const LIST = 'List ten tips for writing clear API docs, one line each.'

// The same body twice: lane 0 waits for the whole reply, lane 1 streams it.
const body = (model: string, text: string, stream: boolean): ThinkBody => ({
  model,
  messages: [{ role: 'user', content: text }],
  temperature: 0,
  ...(stream ? { stream: true, stream_options: { include_usage: true } } : { stream: false }),
})

const LANES = ['"stream": false', '"stream": true']

type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }

// When the lane had its first text (stream) or its whole reply (no stream), and when it finished.
function timings(lane?: Lane) {
  const ex = lane?.exchanges[0]
  const done = lane?.status === 'done' && ex ? ex.ms : undefined
  return { first: ex?.firstTokenMs ?? done, done, chunks: ex?.chunks }
}

interface Arrival {
  at: number
  text: string
}

// The streamed text, one piece per time the page saw it grow. Several SSE chunks that reach the
// browser in one network read land as one piece. Times are anchored on the shell's first-token time.
function useArrivals(lane: Lane | undefined): Arrival[] {
  const [arrivals, setArrivals] = useState<Arrival[]>([])
  const seen = useRef({ len: 0, t0: 0 })
  const reply = lane?.reply ?? ''
  const first = lane?.exchanges.at(-1)?.firstTokenMs
  useEffect(() => {
    if (reply.length <= seen.current.len) return
    const now = performance.now()
    if (seen.current.len === 0) seen.current.t0 = now - (first ?? 0)
    const piece = reply.slice(seen.current.len)
    seen.current.len = reply.length
    setArrivals((a) => [...a, { at: Math.round(now - seen.current.t0), text: piece }])
  }, [reply, first])
  return arrivals
}

// Both lanes on one time scale: the wait, then the reply (all at once, or piece by piece).
function Timeline({ plain, streamed, arrivals }: { plain?: Lane; streamed?: Lane; arrivals: Arrival[] }) {
  const a = timings(plain)
  const b = timings(streamed)
  if (a.done === undefined || b.done === undefined || b.first === undefined) return null
  const end = b.done
  const max = Math.max(a.done, end) * 1.05
  const pct = (ms: number) => `${(ms / max) * 100}%`
  return (
    <div className="ts-timeline" aria-label="Timeline">
      <div className="ts-row">
        <span className="ts-row__label">false</span>
        <span className="ts-track">
          <span className="ts-wait" style={{ width: pct(a.done) }} />
          <span className="ts-tick ts-tick--whole" style={{ left: pct(a.done) }} title={`whole reply at ${a.done} ms`} />
        </span>
        <span className="ts-row__ms">{a.done} ms</span>
      </div>
      <div className="ts-row">
        <span className="ts-row__label">true</span>
        <span className="ts-track">
          <span className="ts-wait" style={{ width: pct(b.first) }} />
          <span className="ts-flow" style={{ left: pct(b.first), width: pct(b.done - b.first) }} />
          {arrivals.map((p, i) => (
            <span className="ts-tick" key={i} style={{ left: pct(Math.min(p.at, end)) }} />
          ))}
        </span>
        <span className="ts-row__ms">
          {b.first} / {b.done} ms
        </span>
      </div>
      <p className="ts-legend">Grey is waiting. One tick per time the streamed text grew on this page; the bar ends when <code>[DONE]</code> arrived.</p>
    </div>
  )
}

function LaneBox({ lane, title, arrivals }: { lane?: Lane; title: string; arrivals?: Arrival[] }) {
  const { reply } = splitReasoning(lane?.reply ?? '')
  const t = timings(lane)
  const usage = lane?.usage as Usage | undefined
  const streamed = !!arrivals
  return (
    <div className="llm-lane">
      <h3 className="llm-lane__title">{title}</h3>
      {streamed && arrivals.length > 0 ? (
        <p className="llm-said ts-pieces">
          {arrivals.map((p, i) => (
            <span className="ts-piece" key={i} title={`${p.at} ms`}>
              {p.text}
            </span>
          ))}
        </p>
      ) : (
        <p className={reply ? 'llm-said' : 'llm-said llm-said--muted'}>
          {reply || (lane?.status === 'running' ? (streamed ? 'Waiting for the first chunk…' : 'Waiting for the whole reply…') : '(no text)')}
        </p>
      )}
      {lane?.error && <p className="error">{lane.error}</p>}
      {lane?.status === 'done' && (
        <dl className="llm-stats">
          <dt>first text</dt>
          <dd>{t.first} ms</dd>
          <dt>whole reply</dt>
          <dd>{t.done} ms</dd>
          {streamed && (
            <>
              <dt>SSE chunks</dt>
              <dd>
                {t.chunks}, then <code>[DONE]</code> (the page drew {arrivals.length} pieces)
              </dd>
            </>
          )}
          {usage && (
            <>
              <dt>usage</dt>
              <dd>
                {usage.prompt_tokens} in, {usage.completion_tokens} out
                {streamed ? ', from the last chunk' : ''}
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  )
}

function Result({ run }: { state: State; run?: LlmRun<State> }) {
  const streamed = run?.lanes[1]
  const arrivals = useArrivals(streamed)
  if (!run) return <p className="llm-said llm-said--muted">Both replies show up here, the unstreamed one on the left.</p>
  return (
    <div className="llm-run">
      <p className="llm-said llm-said--muted">{run.text}</p>
      <div className="llm-lanes">
        <LaneBox lane={run.lanes[0]} title={LANES[0]} />
        <LaneBox lane={streamed} title={LANES[1]} arrivals={arrivals} />
      </div>
      <Timeline plain={run.lanes[0]} streamed={streamed} arrivals={arrivals} />
    </div>
  )
}

// The fields that matter from each response: the stream's usage arrives in its last chunk.
function Response({ latest }: { state: State; latest?: LlmRun<State> }) {
  const lanes = latest?.lanes ?? []
  if (lanes.length < 2 || lanes.some((l) => l.status === 'running')) {
    return <span className="wire__key">The fields that matter show up here after a run.</span>
  }
  return (
    <>
      {lanes.map((lane, i) => {
        const ex = lane.exchanges[0]
        const choice = ((ex?.json?.choices as { finish_reason?: string }[] | undefined) ?? [])[0]
        return (
          <span className="wire__part wire__part--text llm-field" key={i}>
            <span className="wire__key">{LANES[i]} →</span>
            {i === 0 ? (
              <>
                {' '}
                <span className="wire__key">"finish_reason":</span> <mark>{JSON.stringify(choice?.finish_reason)}</mark>,{' '}
                <span className="wire__key">"usage":</span> <mark>{JSON.stringify(lane.usage)}</mark>
              </>
            ) : (
              <>
                {' '}
                <span className="wire__key">{ex?.chunks} chunks, last one</span> <mark>{JSON.stringify({ choices: [], usage: lane.usage })}</mark>{' '}
                <span className="wire__key">then</span> <mark>data: [DONE]</mark>
              </>
            )}
          </span>
        )
      })}
    </>
  )
}

export default defineLlmFeature<State>({
  kind: 'llm',
  api: 'think',
  copy: {
    headline: 'Read the first word before the reply is done.',
    lede: 'Your message goes to /v1/think twice at the same moment, once with stream false and once with stream true. The streamed one shows text as soon as the first token is ready; the other shows nothing until the whole reply is done. Early Access.',
    ctaTitle: 'Set stream: true on /v1/think.',
    ctaBody: (
      <>
        Deepgram LLMs take a Chat Completions body at <code>agent.deepgram.com/v1/think</code>. Streaming needs{' '}
        <code>{'"stream_options": {"include_usage": true}'}</code>, and the token counts arrive in the last chunk. Early Access, free while it lasts.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/llm/request-response-format' },
  // /v1/think takes text. A spoken question would need a second request to transcribe it first.
  inputs: [{ id: 'text', label: 'Type', source: 'text' }],
  initialState: { model: 'think-fast' },
  variants: THINK_MODELS.map((m) => ({ model: m.id })),
  think: ({ model }, text) => [body(model, text, false), body(model, text, true)],
  highlight: ['stream', 'stream_options'],
  runLabel: ({ model }) => `${THINK_MODELS.find((m) => m.id === model)?.label ?? model}, unstreamed and streamed`,
  texts: () => [LONG, LIST, SHORT],
  Controls({ state, setState, busy }) {
    return (
      <div className="segmented" role="radiogroup" aria-label="Model">
        {THINK_MODELS.map((m) => (
          <button
            key={m.id}
            role="radio"
            aria-checked={state.model === m.id}
            className={state.model === m.id ? 'segmented__opt is-on' : 'segmented__opt'}
            disabled={busy}
            onClick={() => setState({ model: m.id })}
          >
            {m.label}
          </button>
        ))}
      </div>
    )
  },
  Response,
  Result,
})
