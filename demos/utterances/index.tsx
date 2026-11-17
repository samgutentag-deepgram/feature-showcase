// utterances + utt_split on Nova-3, pre-recorded: the same lines come back as timed utterances, and
// utt_split sets how long a pause has to be before a new one starts.
// Checked 2026-11-16: Flux /v2/listen answers utterances=true and utt_split with a 400 at the
// handshake. The streaming /v1/listen socket opens with both but never sends an utterances field
// (only Results and Metadata), so this page records and sends one POST. On macOS `say` clips,
// utt_split values from 0.05 to 0.8 split in the same places: a measured 0.3 s silence never split,
// a 0.7 s one split at 0.8 and below and not at 1.0. So the choices start at the 0.8 default.
// Utterance start and end are word times, so the gap between rows is shorter than the silence
// measured in the audio.
import { defineFeature, type Json, type Params } from '../../shared/common/feature'
import { EmptyTranscript, PlainTranscript } from '../../shared/stt/PlainTranscript'
import './styles.css'

export const SPLITS = ['0.8', '1.5', '3'] as const
export type Split = (typeof SPLITS)[number]

interface State {
  split: Split
}

export interface Utterance {
  start: number
  end: number
  confidence: number
  transcript: string
}

// What a run keeps from the response: the flat transcript, and the utterances when they came back.
export interface Echo {
  transcript: string
  utterances?: Utterance[]
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

// results.utterances of a pre-recorded response, read into an Echo.
export function readUtterances(json: Json): Echo | undefined {
  const results = json.results as Json | undefined
  const alt = ((results?.channels as Json[] | undefined)?.[0]?.alternatives as Json[] | undefined)?.[0]
  if (!alt) return undefined
  const transcript = String(alt.transcript ?? '')
  const list = results?.utterances as Json[] | undefined
  if (!Array.isArray(list)) return { transcript }
  const utterances = list.map((u) => ({
    start: num(u.start),
    end: num(u.end),
    confidence: num(u.confidence),
    transcript: String(u.transcript ?? ''),
  }))
  return { transcript, utterances }
}

const secs = (t: number) => t.toFixed(2)

function Utterances({ utterances, split }: { utterances: Utterance[]; split: string }) {
  return (
    <div className="transcript" aria-live="polite">
      <p className="utt__head">
        {utterances.length} {utterances.length === 1 ? 'utterance' : 'utterances'} at utt_split={split}
      </p>
      <ol className="utt__rows">
        {utterances.map((u, i) => (
          <li className="utt__item" key={i}>
            {i > 0 && (
              <p className="utt__gap">
                {secs(Math.max(0, u.start - utterances[i - 1].end))} s between the last word and the next
              </p>
            )}
            <div className="utt__row">
              <span className="utt__time">
                {secs(u.start)}–{secs(u.end)} s
              </span>
              <span className="utt__text">{u.transcript}</span>
              <span className="utt__conf">{u.confidence.toFixed(2)}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

// Three sentences, a pause of about a second after the first and about two after the second. On a
// say clip with those pauses, 0.8 gave 3 utterances, 1.5 gave 2, and 3 gave 1.
export const SCRIPT =
  'The package left the warehouse this morning. (pause, about a second) It should arrive on Friday. (long pause, count to two) Please sign for it at the front desk.'

export default defineFeature<State>({
  copy: {
    headline: 'How long a pause starts a new utterance?',
    lede: 'Record the lines below with a pause of about a second, then a longer one. Deepgram returns results.utterances: timed rows, each with a transcript and a confidence. Pick utt_split, the pause in seconds that starts a new row, then record again with another value and compare where the splits land.',
    ctaTitle: 'Add utterances=true&utt_split=1.5 to your next pre-recorded request.',
    ctaBody: (
      <>
        <code>utterances=true</code> adds <code>results.utterances[]</code> to a pre-recorded <code>/v1/listen</code>{' '}
        response: <code>start</code>, <code>end</code>, <code>confidence</code>, <code>channel</code>,{' '}
        <code>transcript</code>, and <code>words</code> for each stretch of speech. <code>utt_split</code> is the
        silence, in seconds, that ends one (0.8 by default). New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/utterances' },
  models: [
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3', punctuate: 'true' },
      note: 'Nova-3 only. Flux does not support utterances or utt_split yet (/v2/listen answers them with a 400). Pre-recorded only: the streaming socket takes the params but never sends utterances back, so Record keeps up to 30 seconds and sends one POST. In testing, values under 0.8 split in the same places as 0.8.',
    },
  ],
  // Mic, pre-recorded. Runs stay side by side so two utt_split values can be compared.
  modes: [{ id: 'rec', label: 'Record', source: 'mic', batch: true, compare: true }],
  initialState: { split: '0.8' },
  variants: SPLITS.map((split) => ({ split })),
  promptState: { split: '1.5' },

  params: ({ split }): Params => ({ utterances: 'true', utt_split: split }),
  highlight: ['utterances', 'utt_split'],

  runLabel: ({ split }) => `utt_split=${split}`,
  actionLabel: ({ split }) => `Run with utt_split=${split}`,
  compareTip: () => 'Pick another utt_split and record the same lines again, with the same pauses.',

  phrases: () => [SCRIPT],

  echo: (msg) => readUtterances(msg),

  Controls({ state, setState, ctx }) {
    return (
      <div className="segmented" role="radiogroup" aria-label="utt_split, in seconds">
        {SPLITS.map((s) => (
          <button
            key={s}
            role="radio"
            aria-checked={state.split === s}
            className={state.split === s ? 'segmented__opt is-on' : 'segmented__opt'}
            disabled={ctx.busy}
            onClick={() => setState({ split: s })}
          >
            utt_split={s}
          </button>
        ))}
      </div>
    )
  },

  Response({ latest }) {
    const e = latest?.echoed as Echo | undefined
    if (!e) return <span className="wire__key">The utterances from the last response show up here after a run.</span>
    if (!e.utterances) {
      return (
        <span className="wire__part wire__part--text">
          <span className="wire__key">"transcript":</span> {JSON.stringify(e.transcript)}, and no{' '}
          <span className="wire__key">"utterances"</span>
        </span>
      )
    }
    const first = e.utterances[0]
    return (
      <span className="wire__part wire__part--text">
        <mark>"utterances"</mark>: [
        {first && (
          <>
            {' { "start": '}
            {first.start}, "end": {first.end}, "confidence": {first.confidence}, "transcript": {JSON.stringify(first.transcript)}
            {', "words": [ … ] }'}
          </>
        )}
        , … ] with <mark>{e.utterances.length}</mark> {e.utterances.length === 1 ? 'utterance' : 'utterances'}
      </span>
    )
  },

  // Timed rows when the run had utterances; the flat transcript when it did not.
  Result({ run, live }) {
    const e = run?.echoed as Echo | undefined
    if (run && e?.utterances?.length) return <Utterances utterances={e.utterances} split={run.state.split} />
    if (run) {
      return <PlainTranscript committed={run.committed} pending={run.pending} live={live} emptyText="No words came back. Try reading the lines again." />
    }
    return <EmptyTranscript live={live} text="Your utterances show up here as timed rows." />
  },
})
