// Configure on Flux: change keyterms, turn thresholds, and numerals on an open /v2/listen socket,
// without reconnecting. One socket, the same phrase read before and after.
// Checked live 2026-11-16 on flux-general-en (macOS voice Samantha, "Please open the Kallistrum
// dashboard and sync it with Vexmoor.", one socket, the clip twice):
//   before: "Please open the colistrum dashboard and sync it with Vexmor."
//   -> {"type":"Configure","keyterms":["Kallistrum","Vexmoor"]}
//   <- ConfigureSuccess within 60 ms: {"thresholds":{"eot_threshold":0.7,"eager_eot_threshold":null,
//      "eot_timeout_ms":5000},"keyterms":["Kallistrum","Vexmoor"],"profanity_filter":false,
//      "redact_usage":false,"numerals":false}
//   after:  "Please open the Kallistrum dashboard and sync it with Vexmoor."
//   With "thresholds":{"eot_threshold":0.8} added, ConfigureSuccess echoed eot_threshold 0.8.
//   {"type":"Configure","numerals":true}: "four eight one five" became "4 8 1 5" on the next turn.
//   eager_eot_threshold 0.9 over eot_threshold 0.5: ConfigureFailure, UNPARSABLE_CLIENT_MESSAGE,
//   "eager_eot_threshold cannot be greater than eot_threshold.", and the socket kept transcribing.
//   {"type":"Configure","numerals":"true"}: Error, UNPARSABLE_CLIENT_MESSAGE ("expected a boolean"),
//   and Flux closed the socket (1005).
// Verified live 2026-11-16: ONLY=flux-configure-midstream pnpm verify:live passed. /v2/listen?model=flux-general-en&eot_threshold=0.7 opened in both variants; Send Configure (keyterms, plus eot_threshold 0.8 and numerals true) and Clear keyterms came back ConfigureSuccess, Send an invalid Configure came back ConfigureFailure, with no Error; prompt.md URL accepted.
import { defineFeature, type Json, type Params, type SttEvent } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import './styles.css'

interface State {
  // What the visitor typed: terms separated by commas.
  terms: string
  // Also raise eot_threshold from Flux's default 0.7 to 0.8 in the same Configure.
  stricter: boolean
  // Also turn numerals on in the same Configure.
  numerals: boolean
}

export const DEFAULT_TERMS = 'Kallistrum, Vexmoor'
// Configure takes up to 100; a short list keeps the demo readable.
export const MAX_TERMS = 20
export const MAX_TERM_LENGTH = 50
export const START_EOT = 0.7
export const STRICTER_EOT = 0.8

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

// The message the main button sends. Fields left out keep their current values on the socket.
export function configureMessage(state: State): Json {
  return {
    type: 'Configure',
    keyterms: parseTerms(state.terms),
    ...(state.stricter ? { thresholds: { eot_threshold: STRICTER_EOT } } : {}),
    ...(state.numerals ? { numerals: true } : {}),
  }
}

export const CLEAR: Json = { type: 'Configure', keyterms: [] }
// Fails validation (eager above eot), so Flux answers ConfigureFailure and keeps the old settings.
export const INVALID: Json = { type: 'Configure', thresholds: { eager_eot_threshold: 0.9, eot_threshold: 0.5 } }

// A sentence that uses the typed terms, so each is said once. Numerals add a number to read.
export function phraseFor(terms: readonly string[], numerals: boolean): string {
  const [a, b, ...rest] = terms
  if (!a) return 'Type a product name or two above, made-up ones work best.'
  let line = b ? `Please open the ${a} dashboard and sync it with ${b}.` : `Please open the ${a} dashboard.`
  if (rest.length) line += ` Then add ${rest.join(', ')}.`
  if (numerals) line += ' The order number is four eight one five.'
  return line
}

// Splits text into plain and matched pieces, so the terms Flux got right are marked.
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

// One row of the before/after view, built from the run's timeline.
export type Row =
  | { kind: 'turn'; transcript: string; after: boolean; keyterms: string[] }
  | { kind: 'sent'; message: string }
  | { kind: 'ack'; name: string; note: string; ok: boolean }

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [])

// Every finished turn, labeled before or after the first applied Configure, with each Configure
// and its answer in between. Turns are marked with the keyterms active when they ended.
export function rows(events: readonly SttEvent[]): Row[] {
  const out: Row[] = []
  let applied = false
  let keyterms: string[] = []
  for (const e of events) {
    const m = e.msg ?? {}
    if (e.sent && e.name === 'Configure') out.push({ kind: 'sent', message: JSON.stringify(m) })
    else if (e.name === 'ConfigureSuccess') {
      applied = true
      keyterms = strings(m.keyterms)
      const eot = (m.thresholds as Json | undefined)?.eot_threshold
      out.push({ kind: 'ack', name: e.name, ok: true, note: `keyterms ${JSON.stringify(keyterms)}, eot_threshold ${eot}, numerals ${m.numerals}` })
    } else if (e.name === 'ConfigureFailure' || e.name === 'Error') {
      out.push({ kind: 'ack', name: e.name, ok: false, note: String(m.description ?? m.code ?? '') })
    } else if (e.name === 'EndOfTurn' && !e.sent) {
      out.push({ kind: 'turn', transcript: String(m.transcript ?? ''), after: applied, keyterms })
    }
  }
  return out
}

function Marked({ text, terms }: { text: string; terms: readonly string[] }) {
  return (
    <>
      {markTerms(text, terms).map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
    </>
  )
}

interface Echo {
  name: string
  msg: Json
}

export default defineFeature<State>({
  copy: {
    headline: 'Teach Flux a new word mid-call',
    lede: 'Start the mic and read the phrase. The product names are made up, so Flux has no reason to know them. Pause until the turn ends, press Send Configure, and read it again. Same socket, no reconnect: the keyterms apply from the next audio on.',
    ctaTitle: 'Send Configure on your open Flux socket.',
    ctaBody: (
      <>
        One JSON text frame on <code>/v2/listen</code> swaps <code>keyterms</code>, the turn{' '}
        <code>thresholds</code>, and <code>numerals</code> while the audio keeps flowing. Flux answers{' '}
        <code>ConfigureSuccess</code> with the whole active setup. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/flux/configure' },
  // Flux only: Configure is a message on the open Flux socket, so the URL never changes.
  models: [
    {
      id: 'flux',
      label: 'Flux',
      endpoint: 'v2',
      params: { model: 'flux-general-en' },
      note: 'Flux only. Configure is a message on the open /v2/listen socket, not a query param. The URL sets the starting values; Configure changes them without reconnecting.',
    },
  ],
  // Live mic only. One run holds the before and the after.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic' }],
  initialState: { terms: DEFAULT_TERMS, stricter: false, numerals: false },
  variants: [
    { terms: DEFAULT_TERMS, stricter: false, numerals: false },
    { terms: DEFAULT_TERMS, stricter: true, numerals: true },
  ],
  promptState: { terms: DEFAULT_TERMS, stricter: true, numerals: false },

  // The starting threshold, stated on the URL (Flux's default) so the card shows what Configure changes.
  params: (): Params => ({ eot_threshold: String(START_EOT) }),
  highlight: ['eot_threshold'],

  runLabel: () => 'one socket, Configure mid-stream',

  actions: (state) => [
    { label: 'Send Configure', message: configureMessage(state), ack: ['ConfigureSuccess'], primary: true },
    { label: 'Clear keyterms', message: CLEAR, ack: ['ConfigureSuccess'] },
    { label: 'Send an invalid Configure', message: INVALID, ack: ['ConfigureFailure'] },
  ],
  timeline: { mark: ['Configure', 'ConfigureSuccess', 'ConfigureFailure', 'Error'] },

  phrases: (state) => [phraseFor(parseTerms(state.terms), state.numerals), '(pause, press Send Configure, then read it again)'],

  // The last answer to a Configure. Transcripts stay in the before/after view.
  echo: (msg): Echo | undefined =>
    msg.type === 'ConfigureSuccess' || msg.type === 'ConfigureFailure' || msg.type === 'Error'
      ? { name: String(msg.type), msg }
      : undefined,

  Controls({ state, setState }) {
    // Editable mid-stream too: Send Configure sends whatever is typed right now.
    return (
      <div className="field fcm-field">
        <label className="fcm-label" htmlFor="fcm-terms">
          Keyterms for the Configure message, separated by commas
        </label>
        <input
          id="fcm-terms"
          className="fcm-input"
          type="text"
          value={state.terms}
          onChange={(e) => setState({ ...state, terms: e.target.value })}
        />
        <label className="check">
          <input type="checkbox" checked={state.stricter} onChange={(e) => setState({ ...state, stricter: e.target.checked })} />
          Also raise eot_threshold from {START_EOT} to {STRICTER_EOT} (Flux waits to be surer you are done)
        </label>
        <label className="check">
          <input type="checkbox" checked={state.numerals} onChange={(e) => setState({ ...state, numerals: e.target.checked })} />
          Also turn on numerals ("four eight one five" becomes "4 8 1 5")
        </label>
        <p className="note">
          Configure replaces the whole keyterm list. A value Flux rejects, like eager_eot_threshold above
          eot_threshold, gets ConfigureFailure and the stream keeps going with the old settings. A message
          that breaks the schema, like "numerals": "true" as a string, gets an Error and Flux closes the
          socket, so the run ends. Both checked live 2026-11-16.
        </p>
      </div>
    )
  },

  Response({ latest }) {
    const e = latest?.echoed as Echo | undefined
    if (!e) return <span className="wire__key">Flux's answer to your Configure shows up here.</span>
    const { request_id: _id, sequence_id: _seq, ...rest } = e.msg
    return (
      <span className="wire__part wire__part--text fcm-echo">
        <mark>{JSON.stringify(rest)}</mark>
      </span>
    )
  },

  // Turns before and after the Configure, with the message and its answer in between.
  Result({ run, live }) {
    const list = run ? rows(run.events) : []
    const open = run ? run.pending.map((w) => w.text).join(' ') : ''
    if (list.length === 0 && !open) {
      return <EmptyTranscript live={live} text="Each finished turn shows up here, marked before or after your Configure." />
    }
    return (
      <div className="transcript fcm-rows" aria-live="polite">
        {list.map((r, i) =>
          r.kind === 'turn' ? (
            <div className={r.after ? 'fcm-turn is-after' : 'fcm-turn'} key={i}>
              <span className="fcm-turn__tag">{r.after ? 'After' : 'Before'}</span>
              <p className="fcm-turn__text">
                <Marked text={r.transcript} terms={r.after ? r.keyterms : []} />
              </p>
            </div>
          ) : r.kind === 'sent' ? (
            <div className="fcm-msg" key={i}>
              <span className="fcm-msg__tag">Sent</span>
              <code>{r.message}</code>
            </div>
          ) : (
            <div className={r.ok ? 'fcm-msg is-ok' : 'fcm-msg is-bad'} key={i}>
              <span className="fcm-msg__tag">{r.name}</span>
              <span>{r.note}</span>
            </div>
          ),
        )}
        {open && (
          <div className="fcm-turn is-open">
            <span className="fcm-turn__tag">Now</span>
            <p className="fcm-turn__text word--pending">{open}</p>
          </div>
        )}
      </div>
    )
  },
})
