// keywords on Nova-2: the legacy way to boost rare words, each with a weight (intensifier).
// Nova-3 and Flux dropped it for keyterm: nova-3 answers keywords with a 400 ("Keywords are not
// supported for Nova-3. Please use `keyterm` instead."), and /v2/listen refuses it at the handshake.
// Checked 2026-11-16 on /v1/listen pre-recorded, nova-2, smart_format=true, a `say` clip: without
// keywords "Callistrum", "Vexmor"; with keywords=Kallistrum:2&keywords=Vexmoor:2&keywords=Trellisync:2
// "Kallistrum" both times and "Vexmoor" once. Streaming nova-2 gave the same change.
// Verified live 2026-11-16: ONLY=keywords-legacy pnpm verify:live passed (nova-2 socket opened for keywords off and :1, :2, :5, prompt URLs and docs link OK); pre-recorded nova-2 with keyterm.mp3 went from "Callistrum", "Vexmor" to "Kallistrum", "Vexmoor" with keywords=Kallistrum:2&keywords=Vexmoor:2&keywords=Trellisync:2; nova-3 + keywords is a 400 and the flux-general-en handshake with keywords is a 400 (101 without).
import { defineFeature, type Params, type Word } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import { finalTranscript } from '../../shared/stt/stream'
import './styles.css'

interface State {
  on: boolean
  // What the visitor typed: terms separated by commas, each optionally `Term:weight`.
  terms: string
  // The intensifier for every term typed without its own weight.
  boost: number
}

export const DEFAULT_TERMS = 'Kallistrum, Vexmoor, Trellisync'
export const BOOSTS = [1, 2, 5] as const
export const DEFAULT_BOOST = 2
export const MAX_TERMS = 20
export const MAX_TERM_LENGTH = 50
// Docs suggest small weights; a wild one only adds false hits, so typed weights are clamped.
// No negatives: suppression works on Base models only, per the docs, not on Nova-2.
export const MAX_WEIGHT = 10

export interface Keyword {
  term: string
  weight: number
}

// "Vexmoor:3" keeps its own weight; a bare term takes the picked boost.
export function parseKeywords(text: string, boost: number): Keyword[] {
  const seen = new Set<string>()
  const out: Keyword[] = []
  for (const raw of text.split(/[,\n]/)) {
    const m = raw.trim().match(/^(.*?)(?::\s*(\d+(?:\.\d+)?))?$/)
    const term = (m?.[1] ?? '').trim().replace(/\s+/g, ' ').replace(/:/g, '').slice(0, MAX_TERM_LENGTH)
    if (!term || seen.has(term.toLowerCase())) continue
    const typed = m?.[2] === undefined ? boost : Number(m[2])
    const weight = Math.min(MAX_WEIGHT, typed)
    seen.add(term.toLowerCase())
    out.push({ term, weight })
  }
  return out.slice(0, MAX_TERMS)
}

export const toParam = (k: Keyword) => `${k.term}:${k.weight}`

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

const sent = (state: State) => (state.on ? parseKeywords(state.terms, state.boost) : [])
const names = (state: State) => parseKeywords(state.terms, state.boost).map((k) => k.term)

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
    return <EmptyTranscript live={live} text="Your transcript shows up here, with your keywords marked." />
  }
  const committed = words.filter((w) => !w.pending).map((w) => w.text).join(' ')
  const pending = words.filter((w) => w.pending).map((w) => w.text).join(' ')
  return (
    <div className="transcript" aria-live="polite">
      <p className="transcript__text keywords-text">
        <Marked text={committed} terms={terms} /> <span className="word--pending">{pending}</span>
      </p>
    </div>
  )
}

export default defineFeature<State>({
  copy: {
    headline: 'Still on Nova-2? Boost your words with keywords.',
    lede: 'Before keyterm there was keywords: a list of rare words, each with a weight, on Nova-2 and older models. Read the phrase without keywords, then send them and read it again.',
    ctaTitle: 'Moving to Nova-3 or Flux? Use keyterm.',
    ctaBody: (
      <>
        <code>keywords</code> works on Nova-2 and older models only. Nova-3 and Flux answer it with a 400 and take{' '}
        <code>keyterm</code> instead, with no weights to tune: <a href="/demos/keyterm/">try the keyterm demo</a>. New
        accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/keywords' },
  // Nova-2 only: nova-3 and Flux both refuse keywords (400), so there is no model toggle.
  models: [
    {
      id: 'nova-2',
      label: 'Nova-2',
      endpoint: 'v1',
      params: { model: 'nova-2', smart_format: 'true' },
      note: 'Nova-2 only. Nova-3 and Flux use keyterm instead and answer keywords with a 400. See the keyterm demo for them.',
    },
  ],
  // Live mic only. Runs stay side by side so the same phrase can be read without, then with.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { on: false, terms: DEFAULT_TERMS, boost: DEFAULT_BOOST },
  variants: [
    { on: false, terms: DEFAULT_TERMS, boost: DEFAULT_BOOST },
    ...BOOSTS.map((boost) => ({ on: true, terms: DEFAULT_TERMS, boost })),
  ],
  promptState: { on: true, terms: DEFAULT_TERMS, boost: DEFAULT_BOOST },

  // Off means no keywords param at all, not an empty one.
  params(state): Params {
    const kws = sent(state)
    return kws.length ? { keywords: kws.map(toParam) } : {}
  },
  highlight: ['keywords'],

  runLabel: (state) => (sent(state).length ? `keywords ${sent(state).map(toParam).join(', ')}` : 'no keywords'),
  actionLabel: (state) => (sent(state).length ? 'Run with keywords' : 'Run without keywords'),
  compareTip: (state) =>
    sent(state).length
      ? 'Turn keywords off and run it again to compare.'
      : 'Turn on keywords and run it again to compare.',

  phrases: (state) => [phraseFor(names(state))],

  echo: (msg) => finalTranscript(msg),

  Controls({ state, setState, ctx }) {
    return (
      <div className="field keywords-field">
        <label className="check">
          <input
            type="checkbox"
            checked={state.on}
            disabled={ctx.busy}
            onChange={(e) => setState({ ...state, on: e.target.checked })}
          />
          Send keywords
        </label>
        <input
          className="keywords-input"
          type="text"
          aria-label="Keywords, separated by commas. add :weight to one to give it its own intensifier"
          value={state.terms}
          disabled={ctx.busy}
          onChange={(e) => setState({ ...state, terms: e.target.value })}
        />
        <div className="keywords-boost">
          <span className="hint">Intensifier</span>
          <div className="segmented" role="radiogroup" aria-label="Intensifier for each keyword">
            {BOOSTS.map((b) => (
              <button
                key={b}
                type="button"
                role="radio"
                aria-checked={state.boost === b}
                className={state.boost === b ? 'segmented__opt is-on' : 'segmented__opt'}
                disabled={ctx.busy}
                onClick={() => setState({ ...state, boost: b })}
              >
                :{b}
              </button>
            ))}
          </div>
          <span className="hint">Type Term:3 to give one term its own weight, up to 10. Start low: high weights add false hits.</span>
        </div>
      </div>
    )
  },

  Response({ latest }) {
    if (typeof latest?.echoed !== 'string') {
      return <span className="wire__key">The last final transcript shows up here after a run.</span>
    }
    return (
      <span className="wire__part keywords-echo">
        <span className="wire__key">"transcript":</span> "<Marked text={latest.echoed} terms={names(latest.state)} />"
      </span>
    )
  },

  Result({ run, state, live }) {
    const words = run ? [...run.committed, ...run.pending] : []
    return <Transcript words={words} terms={names(run?.state ?? state)} live={live} />
  },
})
