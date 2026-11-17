// Sentiment analysis: sentiment=true on /v1/read (typed text) and /v1/listen (the mic, recorded then
// sent once). Deepgram splits the text into segments where the mood shifts and tags each positive,
// neutral, or negative with a score from -1 to 1, plus an average for the whole text. The break
// point is +-0.333: a score of -0.25 is still neutral.
// Checked 2026-11-16 before building: Flux (/v2/listen) answers 400 "Unknown query parameters:
// sentiment" at the handshake. The /v1/listen socket opens with sentiment=true but no message
// carries sentiment, so this demo is batch only, though the docs page badges it "Streaming: Nova".
// Verified live 2026-11-16: ONLY=sentiment pnpm verify:live passed (/v1/read with the first text and
// /v1/listen with the phrase spoken by Aura-2, both return results.sentiments; prompt.md requests
// pass with a granted Bearer token). By hand, /v1/read gave negative -0.49, neutral +0.00, positive
// +0.78, average neutral -0.11; /v1/listen on a macOS-voice read of the phrase gave negative -0.46,
// neutral -0.25, positive +0.71, average neutral -0.16.
import './styles.css'
import { defineLlmFeature } from '../../shared/llm/feature'
import { analysis, type Segment } from '../../shared/llm/request'

type State = Record<string, never>

const ANNOYED_THEN_PLEASED =
  'I have been on hold for forty minutes and my order arrived broken again. Honestly, I was ready to cancel. But your agent fixed it in two minutes and refunded the shipping. Thank you, that was great service.'
const CRASH_THEN_THANKS =
  'The app crashed twice during checkout and I lost my cart. The second time I called, support stayed on the line until it went through. I really appreciate that.'

// Deepgram's break point between neutral and positive or negative.
const BREAK = 1 / 3
const signed = (n: number) => (n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2))
const mood = (s?: string) => (s === 'positive' || s === 'negative' ? s : 'neutral')
// -1..1 to 0..100% along the meter.
const at = (score: number) => `${((Math.max(-1, Math.min(1, score)) + 1) / 2) * 100}%`

function Meter({ score, label }: { score: number; label: string }) {
  return (
    <div className="sent-meter" role="img" aria-label={`${label}: ${signed(score)} on a scale from -1 to +1`}>
      <span className="sent-meter__track" />
      <span className="sent-meter__break" style={{ left: at(-BREAK) }} />
      <span className="sent-meter__break" style={{ left: at(BREAK) }} />
      <span className="sent-meter__dot" style={{ left: at(score) }} />
      <span className="sent-meter__ends">
        <span>-1</span>
        <span>0</span>
        <span>+1</span>
      </span>
    </div>
  )
}

function Segments({ segments }: { segments: Segment[] }) {
  if (!segments.length) return <p className="llm-said llm-said--muted">Nothing came back for this text.</p>
  return (
    <ol className="sent-segments">
      {segments.map((s, i) => (
        <li key={i} className={`sent-seg sent-seg--${mood(s.sentiment)}`}>
          <span className="sent-seg__text">{s.text}</span>
          <span className="sent-seg__tag">
            {mood(s.sentiment)} {signed(s.sentiment_score ?? 0)}
          </span>
        </li>
      ))}
    </ol>
  )
}

export default defineLlmFeature<State>({
  kind: 'llm',
  api: 'intelligence',
  copy: {
    headline: 'Did the call end better than it started?',
    lede: 'Read the annoyed-then-pleased message aloud, or send it as text. Deepgram splits it where the mood shifts, tags each part positive, neutral, or negative with a score from -1 to +1, and averages the whole thing.',
    ctaTitle: 'Add sentiment=true to your next request.',
    ctaBody: (
      <>
        <code>sentiment</code> works on <code>/v1/listen</code> (pre-recorded audio) and <code>/v1/read</code> (text), in
        English. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/sentiment-analysis' },
  // Mic first; typing is the natural input for /v1/read. Both send the same params.
  inputs: [
    { id: 'mic', label: 'Speak', source: 'mic' },
    { id: 'text', label: 'Type', source: 'text' },
  ],
  initialState: {},
  variants: [{}],
  params: () => ({ sentiment: 'true' }),
  highlight: ['sentiment'],
  runLabel: () => 'sentiment',
  texts: () => [ANNOYED_THEN_PLEASED, CRASH_THEN_THANKS],
  phrases: () => [ANNOYED_THEN_PLEASED],
  // Nothing to switch: sentiment is on or it is not. The legend says how to read the result.
  Controls() {
    return (
      <div className="sent-legend">
        <span className="sent-seg__tag sent-legend--negative">negative below -0.33</span>
        <span className="sent-seg__tag sent-legend--neutral">neutral</span>
        <span className="sent-seg__tag sent-legend--positive">positive above +0.33</span>
      </div>
    )
  },
  Result({ run }) {
    if (!run) return null
    const lane = run.lanes[0]
    const a = analysis(lane?.exchanges.at(-1)?.json)
    return (
      <div className="llm-run">
        <div>
          <h3 className="llm-section__title">{a.transcript !== undefined ? 'Transcript' : 'Text sent'}</h3>
          <p className="llm-said">{a.transcript ?? run.text}</p>
        </div>
        {lane?.status === 'running' && <p className="llm-said llm-said--muted">Waiting for Deepgram…</p>}
        {lane?.error && <p className="error">{lane.error}</p>}
        {a.average && (
          <div>
            <h3 className="llm-section__title">
              Average: {a.average.sentiment} {signed(a.average.sentiment_score)}
            </h3>
            <Meter score={a.average.sentiment_score} label={`Average ${a.average.sentiment}`} />
          </div>
        )}
        {a.sentiments && (
          <div>
            <h3 className="llm-section__title">Segments, in order</h3>
            <Segments segments={a.sentiments} />
          </div>
        )}
      </div>
    )
  },
})
