// Configure on the Nova-3 /v1/listen socket: change keyterms (and numerals) mid-stream, no reconnect.
// Checked live 2026-11-16 on wss /v1/listen?model=nova-3&punctuate=true with the default phrase in a
// macOS voice, read three times on one socket: before, "Please open the Colistrum dashboard. And
// sync it with Vexmar."; {"type":"Configure","keyterms":["Kallistrum","Vexmoor"]} came back in
// about 70 ms as {"type":"ConfigureSuccess","request_id":"…","keyterms":["Kallistrum","Vexmoor"]};
// after, "Please open the Kallistrum dashboard. And sync it with Vexmoor". Then
// {"type":"Configure","features":{"numerals":true}} gave ConfigureSuccess with no keyterms field and
// "four eight one five" became "4 8 1 5"; "keyterms": [] clears (ConfigureSuccess "keyterms": []); a misspelled field
// ("keyterm") is an Error (SchemaError, which lists features, processors, keyterms, language_hints)
// and the socket stays open; Nova-2 answers keyterms with ConfigureFailure
// CONFIGURE_KEYTERMS_NOT_SUPPORTED.
import { defineFeature, type Json, type Params, type SttEvent, type Word } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import './styles.css'

interface State {
  // What the visitor typed: terms separated by commas. Sent by the Configure button, not the URL.
  terms: string
}

export const DEFAULT_TERMS = 'Kallistrum, Vexmoor'
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

export function phraseFor(terms: readonly string[]): string {
  const [a, b] = terms
  const names = !a ? 'the dashboard' : !b ? `the ${a} dashboard` : `the ${a} dashboard and sync it with ${b}`
  return `Please open ${names}. My order number is four eight one five.`
}

// The Configure messages the buttons send. Each one is acked by ConfigureSuccess.
export const configureKeyterms = (state: State): Json => ({ type: 'Configure', keyterms: parseTerms(state.terms) })
export const NUMERALS_ON: Json = { type: 'Configure', features: { numerals: true } }
export const CLEAR_KEYTERMS: Json = { type: 'Configure', keyterms: [] }

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

export interface Segment {
  // What was in effect: "No Configure yet", or what the Configure sent.
  label: string
  text: string[]
}

const finalText = (m: Json | undefined): string => {
  const alt = ((m?.channel as Json | undefined)?.alternatives as Json[] | undefined)?.[0]
  return typeof alt?.transcript === 'string' ? alt.transcript : ''
}

export function describeConfigure(m: Json | undefined): string {
  const parts: string[] = []
  if (Array.isArray(m?.keyterms)) parts.push(m.keyterms.length ? `keyterms ${m.keyterms.join(', ')}` : 'keyterms cleared')
  if (m?.features && typeof m.features === 'object') {
    for (const [k, v] of Object.entries(m.features as Json)) parts.push(`${k} ${v ? 'on' : 'off'}`)
  }
  return parts.length ? `After Configure: ${parts.join(', ')}` : 'After Configure'
}

// The run's final transcripts, cut wherever a Configure was sent. Deepgram applies a Configure to
// audio it has not transcribed yet, so a line right after the cut can already use the new settings.
export function segments(events: readonly SttEvent[]): Segment[] {
  const out: Segment[] = [{ label: 'Before Configure', text: [] }]
  for (const e of events) {
    if (e.sent && e.name === 'Configure') out.push({ label: describeConfigure(e.msg), text: [] })
    else if (!e.sent && /^Results (is_final|speech_final|from_finalize)$/.test(e.name)) {
      const t = finalText(e.msg)
      if (t) out[out.length - 1].text.push(t)
    }
  }
  return out
}

// Every term any Configure in this run sent, plus the box, so a miss before the cut is as easy to
// spot as a hit after it.
const runTerms = (events: readonly SttEvent[], state: State) => {
  const all = [...parseTerms(state.terms)]
  for (const e of events) if (e.sent && Array.isArray(e.msg?.keyterms)) all.push(...(e.msg.keyterms as string[]))
  return [...new Set(all)]
}

function Transcript({ events, pending, terms, live }: { events: readonly SttEvent[]; pending: readonly Word[]; terms: readonly string[]; live: boolean }) {
  const segs = segments(events)
  const said = pending.map((w) => w.text).join(' ')
  if (!said && segs.every((s) => !s.text.length) && segs.length === 1) {
    return <EmptyTranscript live={live} text="Start the mic and read the phrase. Then press Send keyterms and read it again." />
  }
  return (
    <div className="transcript cfg-segments" aria-live="polite">
      {segs.map((s, i) => (
        <div className={`cfg-segment${i > 0 ? ' cfg-segment--after' : ''}`} key={i}>
          <span className="cfg-segment__label">{s.label}</span>
          <p className="transcript__text cfg-text">
            <Marked text={s.text.join(' ')} terms={terms} />
            {i === segs.length - 1 && said && <span className="word--pending"> {said}</span>}
          </p>
        </div>
      ))}
    </div>
  )
}

export default defineFeature<State>({
  copy: {
    headline: 'New keyterms, same socket',
    lede: 'Read the phrase, press Send keyterms, and read it again. One Configure message swaps the keyterms on the open Nova-3 stream: no reconnect, no dropped audio.',
    ctaTitle: 'Send Configure on your next stream.',
    ctaBody: (
      <>
        Send <code>{'{"type": "Configure", "keyterms": [...]}'}</code> on an open <code>/v1/listen</code> socket
        to replace the keyterms, or <code>{'"features": {"numerals": true}'}</code> to change formatting. Each one
        gets a <code>ConfigureSuccess</code> or <code>ConfigureFailure</code> back. New accounts start with $200 in
        free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/configure' },
  models: [
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3' },
      note: 'Nova-3 only. Flux does not support this /v1/listen Configure message; Flux has its own Configure on /v2/listen, shown in the Flux Configure demo. Configure keyterms need Nova-3: Nova-2 answers with ConfigureFailure.',
    },
  ],
  // Live mic only. Before and after are in one run, cut where the Configure was sent.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic' }],
  initialState: { terms: DEFAULT_TERMS },
  variants: [{ terms: DEFAULT_TERMS }],

  // No keyterm in the URL: the stream opens without them and Configure adds them. punctuate keeps the
  // lines readable; smart_format would turn the numbers into digits and hide the numerals button.
  params: (): Params => ({ punctuate: 'true' }),
  // Configure keyterms need a Nova-3 model.
  highlight: ['model'],

  runLabel: (state) => `Configure keyterms ${parseTerms(state.terms).join(', ') || '(none)'}`,

  phrases: (state) => [phraseFor(parseTerms(state.terms))],

  actions: (state) => [
    { label: 'Send keyterms', message: configureKeyterms(state), ack: ['ConfigureSuccess'], primary: true },
    { label: 'Turn numerals on', message: NUMERALS_ON, ack: ['ConfigureSuccess'] },
    { label: 'Clear keyterms', message: CLEAR_KEYTERMS, ack: ['ConfigureSuccess'] },
  ],
  timeline: { mark: ['Configure', 'ConfigureSuccess', 'ConfigureFailure', 'Error'] },

  // The latest answer to a Configure, as Deepgram sent it.
  echo: (msg) => (msg.type === 'ConfigureSuccess' || msg.type === 'ConfigureFailure' || msg.type === 'Error' ? msg : undefined),

  Controls({ state, setState }) {
    return (
      <div className="field cfg-field">
        <label className="cfg-field__label" htmlFor="cfg-terms">
          Keyterms the Send keyterms button sends, separated by commas
        </label>
        <input
          id="cfg-terms"
          className="cfg-input"
          type="text"
          value={state.terms}
          // Editable mid-stream: change the list and press Send keyterms again to replace it.
          onChange={(e) => setState({ ...state, terms: e.target.value })}
        />
      </div>
    )
  },

  Response({ latest }) {
    const m = latest?.echoed as Json | undefined
    if (!m || typeof m !== 'object') {
      return <span className="wire__key">Deepgram's answer to your Configure shows up here.</span>
    }
    const { request_id: _id, ...rest } = m
    return (
      <span className="wire__part wire__part--text cfg-echo">
        <mark>{JSON.stringify(rest)}</mark>
      </span>
    )
  },

  Result({ run, state, live }) {
    const events = run?.events ?? []
    return <Transcript events={events} pending={run?.pending ?? []} terms={runTerms(events, run?.state ?? state)} live={live} />
  },
})
