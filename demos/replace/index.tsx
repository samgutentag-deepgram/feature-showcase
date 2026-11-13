// replace on Nova-3: swap a word Deepgram hears for the text you want. Verified live 2026-11-10 on
// /v1/listen streaming with "Thanks for calling Acme. Our new product, Kallistrum, ships on Monday."
// (macOS voice Samantha):
//   smart_format=true                                  "Thanks for calling Acme. ... ships on Monday."
//   smart_format=true&replace=Acme%3AACME+Corp&replace=Monday%3AMon
//                                                      "Thanks for calling ACME Corp. ... ships on Mon."
// The find side matches the transcript's casing: without smart_format the transcript says "acme",
// and replace=Acme:... does nothing. Flux refuses replace with a 400.
import { defineFeature, type Params, type Word } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import { finalTranscript } from '../../shared/stt/stream'
import './styles.css'

export interface Pair {
  find: string
  to: string
}

interface State {
  on: boolean
  pairs: Pair[]
}


export const DEFAULT_PAIRS: Pair[] = [
  { find: 'Acme', to: 'ACME Corp' },
  { find: 'Monday', to: 'Mon' },
]

// A colon splits find from replacement in the param, so neither side may contain one.
const clean = (s: string) => s.replace(/:/g, '').replace(/\s+/g, ' ').trim()

export function replaceParams(pairs: readonly Pair[]): string[] {
  return pairs
    .map((p) => ({ find: clean(p.find), to: clean(p.to) }))
    .filter((p) => p.find && p.to)
    .map((p) => `${p.find}:${p.to}`)
}

const isDefault = (pairs: readonly Pair[]) =>
  pairs.length === DEFAULT_PAIRS.length && pairs.every((p, i) => p.find === DEFAULT_PAIRS[i].find && p.to === DEFAULT_PAIRS[i].to)

// Marks every replacement that came back, so a hit is easy to see.
function Marked({ words, targets }: { words: readonly Word[]; targets: readonly string[] }) {
  const text = words.filter((w) => !w.pending).map((w) => w.text).join(' ')
  const pending = words.filter((w) => w.pending).map((w) => w.text).join(' ')
  const live = targets.filter(Boolean)
  const re = live.length ? new RegExp(`(${live.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g') : null
  return (
    <p className="transcript__text">
      {re
        ? text.split(re).map((part, i) => (i % 2 ? <mark key={i} className="replaced">{part}</mark> : <span key={i}>{part}</span>))
        : text}{' '}
      <span className="word--pending">{pending}</span>
    </p>
  )
}

export default defineFeature<State>({
  copy: {
    headline: 'Say Acme. Get ACME Corp.',
    lede: 'Pick a word you will say and what it should come back as. Read the phrase with replace off, then on, and watch Deepgram swap it before the transcript reaches you.',
    ctaTitle: 'Add replace to your next request.',
    ctaBody: (
      <>
        <code>replace=find:replacement</code> works on Nova-3, on <code>/v1/listen</code>. Repeat it
        for more than one word, and match the casing the transcript uses. New accounts start with
        $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/find-and-replace' },
  models: [
    // smart_format capitalizes "Acme" and "Monday", which is what the find side has to match.
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3', smart_format: 'true' },
      note: 'Nova-3 only. Flux does not support replace yet (/v2/listen answers it with a 400).',
    },
  ],
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { on: false, pairs: DEFAULT_PAIRS },
  variants: [
    { on: false, pairs: DEFAULT_PAIRS },
    { on: true, pairs: DEFAULT_PAIRS },
  ],

  // Off means no replace param at all.
  params({ on, pairs }, { model }): Params {
    const list = on ? replaceParams(pairs) : []
    return list.length ? { replace: list } : {}
  },
  highlight: ['replace'],

  runLabel: ({ on }, { model }) => (on ? 'with replace' : 'no replace'),
  actionLabel: () => 'Run',
  compareTip: ({ on }) => (on ? 'Turn replace off and read it again to compare.' : 'Turn replace on and read it again to compare.'),

  phrases: ({ pairs }) =>
    isDefault(pairs)
      ? ['Thanks for calling Acme. Our support team is back on Monday.']
      : [`Say a sentence with ${pairs.map((p) => clean(p.find)).filter(Boolean).join(' and ')} in it.`],

  echo: (msg) => finalTranscript(msg),

  Controls({ state, setState, ctx }) {
    const off = ctx.busy
    const setPair = (i: number, next: Pair) => setState({ ...state, pairs: state.pairs.map((p, j) => (j === i ? next : p)) })
    return (
      <div className="field replace-field">
        <label className="check">
          <input type="checkbox" checked={state.on} disabled={off} onChange={(e) => setState({ ...state, on: e.target.checked })} />
          Send replace
        </label>
        {state.pairs.map((p, i) => (
          <div className="replace-pair" key={i}>
            <input aria-label={`Find ${i + 1}`} value={p.find} disabled={off} onChange={(e) => setPair(i, { ...p, find: e.target.value })} />
            <span aria-hidden="true">→</span>
            <input aria-label={`Replace with ${i + 1}`} value={p.to} disabled={off} onChange={(e) => setPair(i, { ...p, to: e.target.value })} />
          </div>
        ))}
      </div>
    )
  },

  Response({ latest }) {
    if (typeof latest?.echoed !== 'string') {
      return <span className="wire__key">The last final transcript shows up here after a run.</span>
    }
    return (
      <span className="wire__part wire__part--text">
        <span className="wire__key">"transcript":</span> <mark>{JSON.stringify(latest.echoed)}</mark>
      </span>
    )
  },

  Result({ run, live }) {
    const words = run ? [...run.committed, ...run.pending] : []
    if (words.length === 0) return <EmptyTranscript live={live} text="Your transcript shows up here, with replacements marked." />
    return (
      <div className="transcript" aria-live="polite">
        <Marked words={words} targets={run?.state.pairs.map((p) => clean(p.to)) ?? []} />
      </div>
    )
  },
})
