// search on Nova-3: Deepgram listens for the terms you send and returns each place it heard one,
// with start, end, and a confidence, matched on sound rather than on the transcript's spelling.
// Checked 2026-11-16 on /v1/listen streaming (nova-3, linear16) with "Our new product, Kallistrum,
// ships with a dashboard called Trellisync." (macOS voice Samantha): the transcript spelled it
// "colistrum", and search=Kallistrum still came back {confidence 0.965, start 1.22, end 2.04,
// snippet "colistrum"}; search=Trellisync gave {confidence 1, start 3.62, end 4.45}. Every final
// Results message carries channel.search for that segment. Flux refuses it: /v2/listen answers
// search with a 400, "Unknown query parameters: search".
import { defineFeature, type Json, type Params, type Word } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import './styles.css'

interface State {
  // What the visitor typed: terms or short phrases separated by commas.
  terms: string
}

export const DEFAULT_TERMS = 'Kallistrum, Trellisync'
// The docs allow up to 50 per request; a short list keeps the card readable.
export const MAX_TERMS = 10
export const MAX_TERM_LENGTH = 50
// A hit at or above this confidence counts as found and is marked in the transcript.
export const FOUND = 0.5
// Hits listed per term on the Response card, best first.
export const SHOWN = 3

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

// A sentence that says every term typed once.
export function phraseFor(terms: readonly string[]): string {
  const [a, b, ...rest] = terms
  if (!a) return 'Type a word or two above, then say a sentence with them in it.'
  const base = !b
    ? `Our new product, ${a}, ships next week.`
    : `Our new product, ${a}, ships with a dashboard called ${b}.`
  return rest.length ? `${base} We will also cover ${rest.join(', ')}.` : base
}

export interface Hit {
  confidence: number
  start: number
  end: number
  snippet: string
}
export interface Found {
  query: string
  hits: Hit[]
}

const isHit = (h: unknown): h is Hit =>
  typeof h === 'object' && h !== null && typeof (h as Hit).confidence === 'number' && typeof (h as Hit).start === 'number'

// Every final Results message carries channel.search for its own segment, so the hits for one
// run are gathered across messages. A final whose start is not later than the last one means a
// new stream began, and the gathered hits start over.
let gathered: Found[] = []
let lastStart = -1

export function resetSearch() {
  gathered = []
  lastStart = -1
}

export function gatherSearch(msg: Json): Found[] | undefined {
  if (msg.type !== 'Results' || msg.is_final !== true) return undefined
  const start = typeof msg.start === 'number' ? msg.start : 0
  if (start <= lastStart) gathered = []
  lastStart = start
  const search = (msg.channel as Json | undefined)?.search
  if (!Array.isArray(search) || search.length === 0) return undefined
  const next = gathered.map((f) => ({ ...f, hits: [...f.hits] }))
  for (const s of search as Json[]) {
    const query = String(s.query ?? '')
    const hits = Array.isArray(s.hits) ? s.hits.filter(isHit) : []
    const row = next.find((f) => f.query === query) ?? next[next.push({ query, hits: [] }) - 1]
    row.hits.push(...hits)
  }
  for (const f of next) f.hits.sort((x, y) => y.confidence - x.confidence)
  gathered = next
  return next
}

const asFound = (v: unknown): Found[] => (Array.isArray(v) ? (v as Found[]) : [])

// The snippets Deepgram matched with confidence at or above FOUND.
export const foundSnippets = (found: readonly Found[]) =>
  found.flatMap((f) => f.hits.filter((h) => h.confidence >= FOUND).map((h) => h.snippet)).filter(Boolean)

// Splits text into plain and matched pieces, so the words search found are marked.
export function markSnippets(text: string, snippets: readonly string[]): Array<{ text: string; hit: boolean }> {
  const uniq = [...new Set(snippets.map((s) => s.trim()).filter(Boolean))].sort((a, b) => b.length - a.length)
  if (!uniq.length) return [{ text, hit: false }]
  const escaped = uniq.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\W+'))
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

const sec = (n: number) => n.toFixed(2)

function Transcript({ words, snippets, live }: { words: readonly Word[]; snippets: readonly string[]; live: boolean }) {
  if (words.length === 0) {
    return <EmptyTranscript live={live} text="Your transcript shows up here, with the words search found marked." />
  }
  const committed = words.filter((w) => !w.pending).map((w) => w.text).join(' ')
  const pending = words.filter((w) => w.pending).map((w) => w.text).join(' ')
  return (
    <div className="transcript" aria-live="polite">
      <p className="transcript__text search-text">
        {markSnippets(committed, snippets).map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}{' '}
        <span className="word--pending">{pending}</span>
      </p>
    </div>
  )
}

export default defineFeature<State>({
  copy: {
    headline: 'Did they say Kallistrum? Search can tell.',
    lede: 'Type the words you are listening for and read the phrase. Deepgram matches them by sound, not spelling, so it finds the word even when the transcript spells it wrong, and tells you when it was said.',
    ctaTitle: 'Add search to your next request.',
    ctaBody: (
      <>
        <code>search</code> works on Nova-3, on <code>/v1/listen</code>, streaming and pre-recorded. Repeat it
        once per term, up to 50. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/search' },
  models: [
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3' },
      note: 'Nova-3 only. Flux does not support search yet (/v2/listen answers it with a 400).',
    },
  ],
  // Live mic only: one person reading the phrase shows the effect.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic' }],
  initialState: { terms: DEFAULT_TERMS },
  variants: [{ terms: DEFAULT_TERMS }],

  // No terms means no search param at all, not an empty one.
  params(state): Params {
    const terms = parseTerms(state.terms)
    return terms.length ? { search: terms } : {}
  },
  highlight: ['search'],

  runLabel: (state) => {
    const terms = parseTerms(state.terms)
    return terms.length ? `search ${terms.join(', ')}` : 'no search terms'
  },

  phrases: (state) => [phraseFor(parseTerms(state.terms))],

  echo: (msg) => gatherSearch(msg),

  Controls({ state, setState, ctx }) {
    return (
      <div className="field search-field">
        <label htmlFor="search-terms">Listen for (comma separated)</label>
        <input
          id="search-terms"
          className="search-input"
          type="text"
          value={state.terms}
          disabled={ctx.busy}
          onChange={(e) => setState({ ...state, terms: e.target.value })}
        />
      </div>
    )
  },

  // channel.search from the run, gathered over its final results: the best hits per term.
  Response({ latest }) {
    const found = asFound(latest?.echoed)
    if (!found.length) {
      return <span className="wire__key">The search hits show up here after a run.</span>
    }
    return (
      <span className="search-echo">
        <span className="wire__key">"search": [</span>
        {found.map((f) => (
          <span className="search-echo__query" key={f.query}>
            <span className="wire__part">
              <span className="wire__key">"query":</span> <mark>{JSON.stringify(f.query)}</mark>,{' '}
              <span className="wire__key">"hits":</span> [
            </span>
            {f.hits.slice(0, SHOWN).map((h, i) => (
              <span className={`wire__part search-echo__hit${h.confidence >= FOUND ? ' search-echo__hit--found' : ''}`} key={i}>
                {'{ '}
                <span className="wire__key">"confidence":</span> {Number(h.confidence.toFixed(3))},{' '}
                <span className="wire__key">"start":</span> {sec(h.start)},{' '}
                <span className="wire__key">"end":</span> {sec(h.end)},{' '}
                <span className="wire__key">"snippet":</span> {JSON.stringify(h.snippet)}
                {' }'}
              </span>
            ))}
            {f.hits.length > SHOWN && <span className="wire__key search-echo__hit">... {f.hits.length - SHOWN} more</span>}
            <span>]</span>
          </span>
        ))}
        <span className="wire__key">]</span>
      </span>
    )
  },

  Result({ run, live }) {
    const words = run ? [...run.committed, ...run.pending] : []
    return <Transcript words={words} snippets={foundSnippets(asFound(run?.echoed))} live={live} />
  },
})
