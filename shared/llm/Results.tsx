// The default Result and Response pieces for the LLM page. A feature can use these as they are, or
// pass its own Result / Response and build from AnalysisView, Segments and LaneView.
import type { ReactNode } from 'react'
import type { Lane, LlmRun } from './feature'
import { analysis, splitReasoning, type Segment } from './request'

const pct = (n: number) => `${Math.round(n * 100)}%`
const signed = (n: number) => (n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2))

// Topics, intents, or sentiment per segment, with the tags Deepgram gave each.
export function Segments({ segments, kind }: { segments: Segment[]; kind: 'topics' | 'intents' | 'sentiments' }) {
  if (!segments.length) return <p className="llm-said llm-said--muted">Nothing came back for this text.</p>
  return (
    <ul className="llm-segments">
      {segments.map((s, i) => (
        <li key={i}>
          <span className="llm-segments__text">{s.text}</span>
          <span className="llm-tags">
            {kind === 'topics' && s.topics?.map((t) => <span className="llm-tag" key={t.topic}>{t.topic} {pct(t.confidence_score)}</span>)}
            {kind === 'intents' && s.intents?.map((t) => <span className="llm-tag" key={t.intent}>{t.intent} {pct(t.confidence_score)}</span>)}
            {kind === 'sentiments' && s.sentiment && (
              <span className={s.sentiment === 'neutral' ? 'llm-tag' : 'llm-tag llm-tag--accent'}>
                {s.sentiment} {signed(s.sentiment_score ?? 0)}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div>
    <h3 className="llm-section__title">{title}</h3>
    {children}
  </div>
)

// Everything an intelligence response carries: the transcript (audio only), then each analysis.
export function AnalysisView({ run }: { run: LlmRun<unknown> }) {
  const lane = run.lanes[0]
  const last = lane?.exchanges.at(-1)?.json
  const a = analysis(last)
  return (
    <div className="llm-run">
      <Section title={a.transcript !== undefined ? 'Transcript' : 'Text sent'}>
        <p className="llm-said">{a.transcript ?? run.text}</p>
      </Section>
      {lane?.status === 'running' && <p className="llm-said llm-said--muted">Waiting for Deepgram…</p>}
      {lane?.error && <p className="error">{lane.error}</p>}
      {lane?.callback && (
        <dl className="llm-stats">
          <dt>request_id</dt>
          <dd>{lane.callback.requestId}</dd>
          <dt>accepted after</dt>
          <dd>{lane.callback.acceptedMs} ms</dd>
          {lane.callback.afterMs !== undefined && (
            <>
              <dt>delivered after</dt>
              <dd>{(lane.callback.afterMs / 1000).toFixed(1)} s, by {lane.callback.method}</dd>
            </>
          )}
        </dl>
      )}
      {a.summary !== undefined && (
        <Section title="Summary">
          <p className="llm-said">{a.summary}</p>
        </Section>
      )}
      {a.topics && (
        <Section title="Topics">
          <Segments segments={a.topics} kind="topics" />
        </Section>
      )}
      {a.intents && (
        <Section title="Intents">
          <Segments segments={a.intents} kind="intents" />
        </Section>
      )}
      {a.sentiments && (
        <Section title={a.average ? `Sentiment, ${a.average.sentiment} on average (${signed(a.average.sentiment_score)})` : 'Sentiment'}>
          <Segments segments={a.sentiments} kind="sentiments" />
        </Section>
      )}
    </div>
  )
}

// One /v1/think conversation: the reply (reasoning apart, when phoneLLM mini writes some), tool
// calls with what the page answered, and the numbers.
export function LaneView({ lane }: { lane: Lane }) {
  const { reasoning, reply } = splitReasoning(lane.reply ?? '')
  const first = lane.exchanges[0]
  const usage = lane.usage as { prompt_tokens?: number; completion_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } } | undefined
  const total = lane.exchanges.reduce((n, e) => n + e.ms, 0)
  return (
    <div className="llm-lane">
      <h3 className="llm-lane__title">{lane.title}</h3>
      {reasoning && <p className="llm-reasoning">{reasoning}</p>}
      <p className={reply ? 'llm-said' : 'llm-said llm-said--muted'}>{reply || (lane.status === 'running' ? 'Waiting for the reply…' : '(no text)')}</p>
      {lane.error && <p className="error">{lane.error}</p>}
      {lane.calls?.map((c, i) => (
        <p className="llm-said llm-said--muted" key={i}>
          Called <code>{c.name}({JSON.stringify(c.args)})</code>, the page answered <code>{JSON.stringify(c.result)}</code>
        </p>
      ))}
      {lane.status === 'done' && (
        <dl className="llm-stats">
          {first?.firstTokenMs !== undefined && (
            <>
              <dt>first token</dt>
              <dd>{first.firstTokenMs} ms</dd>
            </>
          )}
          <dt>{lane.exchanges.length > 1 ? `${lane.exchanges.length} requests` : 'full reply'}</dt>
          <dd>{total} ms</dd>
          {usage && (
            <>
              <dt>tokens</dt>
              <dd>
                {usage.prompt_tokens} in, {usage.completion_tokens} out
                {usage.completion_tokens_details?.reasoning_tokens ? `, ${usage.completion_tokens_details.reasoning_tokens} reasoning` : ''}
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  )
}

export function ThinkView({ run }: { run: LlmRun<unknown> }) {
  return (
    <div className="llm-run">
      <p className="llm-said llm-said--muted">{run.text}</p>
      <div className="llm-lanes">
        {run.lanes.map((l, i) => (
          <LaneView lane={l} key={i} />
        ))}
      </div>
    </div>
  )
}

// The Response card by default: the fields that matter, in the shape Deepgram sent them.
export function DefaultResponse({ latest }: { latest?: LlmRun<unknown> }) {
  const lane = latest?.lanes[0]
  const ex = lane?.exchanges.at(-1)
  if (!ex?.json || lane?.status === 'running') return <span className="wire__key">The fields that matter show up here after a run.</span>
  const r = (ex.json.results ?? {}) as Record<string, unknown>
  const pick: Record<string, unknown> =
    ex.request.api === 'think'
      ? { content: lane?.reply, finish_reason: ((ex.json.choices as { finish_reason?: string }[] | undefined) ?? [])[0]?.finish_reason, usage: ex.json.usage }
      : Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'channels'))
  return (
    <>
      {Object.entries(pick)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => (
          <span className="wire__part wire__part--text llm-field" key={k}>
            <span className="wire__key">"{k}":</span> <mark>{JSON.stringify(v)}</mark>
          </span>
        ))}
    </>
  )
}
