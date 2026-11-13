// keyterm prompting on Nova-3: tell the model which rare words to expect, and it spells them.
// Verified live 2026-11-09 on /v1/listen streaming with samples/keyterm.mp3: without keyterm,
// "Callistram", "Vexmor", "Trella Sync", "Colistrum", "Trello Sync"; with
// keyterm=Kallistrum&keyterm=Vexmoor&keyterm=Trellisync, all six spelled right.
// Repeated params; a multi-word term (keyterm=Trellis+Sync) also works.
import { defineFeature, type Params, type Word } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import { finalTranscript } from '../../shared/stt/stream'
import './styles.css'

interface State {
  on: boolean
  // What the visitor typed: terms separated by commas.
  terms: string
}

export const DEFAULT_TERMS = 'Kallistrum, Vexmoor, Trellisync'
// Deepgram caps keyterms by token count; a short list keeps the demo well under it.
export const MAX_TERMS = 20
export const MAX_TERM_LENGTH = 50

export function parseTerms(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split(/[,\n]/)) {
    const term = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_TERM_LENGTH)
    if (term && !seen.has(term.toLowerCase())) {
      seen.add(term.toLowerCase())
      out.push(term)
    }
  }
  return out.slice(0, MAX_TERMS)
}

// A sentence that uses every term typed, so each one is said at least once.
export function phraseFor(terms: readonly string[]): string {
  const [a, b, c, ...rest] = terms
  if (!a) return 'Type a product name or two above, made-up ones work best.'
  const base = !b
    ? `Let's restart ${a}, then open ${a} again.`
    : !c
      ? `Today we will set up ${a} and connect it to ${b}.`
      : `Welcome to the ${a} onboarding. Today we will set up ${b} and connect it to your ${c} dashboard.`
  return rest.length ? `${base} We will also cover ${rest.join(', ')}.` : base
}

const sent = (state: State) => (state.on ? parseTerms(state.terms) : [])

// Splits text into plain and matched pieces, so the terms Deepgram got right are marked.
export function markTerms(text: string, terms: readonly string[]): Array<{ text: string; hit: boolean }> {
  if (!terms.length) return [{ text, hit: false }]
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi')
  const out: Array<{ text: string; hit: boolean }> = []
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), hit: false })
    out.push({ text: m[0], hit: true })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false })
  return out
}

function Marked({ text, terms }: { text: string; terms: readonly string[] }) {
  return (
    <>
      {markTerms(text, terms).map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
    </>
  )
}

function Transcript({ words, terms, live }: { words: readonly Word[]; terms: readonly string[]; live: boolean }) {
  if (words.length === 0) {
    return <EmptyTranscript live={live} text="Your transcript shows up here, with your keyterms marked." />
  }
  const committed = words.filter((w) => !w.pending).map((w) => w.text).join(' ')
  const pending = words.filter((w) => w.pending).map((w) => w.text).join(' ')
  return (
    <div className="transcript" aria-live="polite">
      <p className="transcript__text keyterm-text">
        <Marked text={committed} terms={terms} /> <span className="word--pending">{pending}</span>
      </p>
    </div>
  )
}

export default defineFeature<State>({
  copy: {
    headline: 'Was that Kallistrum or Callistram?',
    lede: 'Product names, people, and jargon trip up any model the first time. Read the phrase without keyterms, then send the words you expect and read it again.',
    ctaTitle: 'Add keyterm to your next request.',
    ctaBody: (
      <>
        Nova-3 and Flux both take <code>keyterm</code>, on <code>/v1/listen</code> and <code>/v2/listen</code>. Repeat
        it once per term. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/keyterm' },
  // Flux first: it takes keyterm too.
  models: [
    // Verified 2026-11-09 on flux-general-en: without keyterm, kalistrum / Vexmor / TrallisInc;
    // with it, all six right.
    { id: 'flux', label: 'Flux', endpoint: 'v2', params: { model: 'flux-general-en' } },
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3', smart_format: 'true' },
    },
  ],
  // Live mic only. Runs stay side by side so the same phrase can be read without, then with.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { on: false, terms: DEFAULT_TERMS },
  variants: [
    { on: false, terms: DEFAULT_TERMS },
    { on: true, terms: DEFAULT_TERMS },
  ],

  // Off means no keyterm at all, not an empty one.
  params(state): Params {
    const terms = sent(state)
    return terms.length ? { keyterm: terms } : {}
  },
  highlight: ['keyterm'],

  runLabel: (state) => (sent(state).length ? `keyterms ${sent(state).join(', ')}` : 'no keyterms'),
  actionLabel: (state) => (sent(state).length ? 'Run with keyterms' : 'Run without keyterms'),
  compareTip: (state) =>
    sent(state).length
      ? 'Turn keyterms off and run it again to compare.'
      : 'Turn on keyterms and run it again to compare.',

  phrases: (state) => [phraseFor(parseTerms(state.terms))],

  // The last final transcript Deepgram sent, from either model.
  echo: (msg) => finalTranscript(msg),

  Controls({ state, setState, ctx }) {
    return (
      <div className="field keyterm-field">
        <label className="check">
          <input
            type="checkbox"
            checked={state.on}
            disabled={ctx.busy}
            onChange={(e) => setState({ ...state, on: e.target.checked })}
          />
          Send keyterms
        </label>
        <input
          className="keyterm-input"
          type="text"
          aria-label="Keyterms, separated by commas"
          value={state.terms}
          // Editable while off too, so the suggested phrase can use your own terms before run one.
          disabled={ctx.busy}
          onChange={(e) => setState({ ...state, terms: e.target.value })}
        />
      </div>
    )
  },

  // The last final transcript Deepgram sent, with the run's keyterms marked.
  Response({ latest }) {
    if (typeof latest?.echoed !== 'string') {
      return <span className="wire__key">The last final transcript shows up here after a run.</span>
    }
    return (
      <span className="wire__part keyterm-echo">
        <span className="wire__key">"transcript":</span> "<Marked text={latest.echoed} terms={parseTerms(latest.state.terms)} />"
      </span>
    )
  },

  // Marks the typed terms in every run, so a miss is as easy to see as a hit.
  Result({ run, state, live }) {
    const words = run ? [...run.committed, ...run.pending] : []
    return <Transcript words={words} terms={parseTerms((run?.state ?? state).terms)} live={live} />
  },
})
