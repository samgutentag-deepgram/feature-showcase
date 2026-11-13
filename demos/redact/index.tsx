// Redaction on Nova-3: Deepgram swaps sensitive spans for labels like [CREDIT_CARD_1] before the
// transcript leaves its servers. Verified live 2026-11-09 on /v1/listen streaming with
// samples/redact.mp3 (card, expiry, CVV, SSN, phone):
//   redact=pci      card and expiry redacted; CVV, SSN, phone left in
//   redact=ssn      CVV and SSN redacted, both labeled SSN; card left in
//   redact=pii      CVV, SSN, phone redacted; card left in
//   redact=numbers  card, expiry, CVV, SSN, and phone all redacted
// Repeated params (redact=pci&redact=ssn) combine.
// Flux (flux-general-en, /v2/listen), verified 2026-11-10 with the same sample: redact=numbers
// swaps each number for a bare * (no label); pci, ssn and pii answer 400.
import { defineFeature, type Params, type Word } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import { finalTranscript } from '../../shared/stt/stream'
import './styles.css'

export const KINDS = [
  { id: 'pci', label: 'Card numbers', hint: 'pci' },
  { id: 'ssn', label: 'Social Security numbers', hint: 'ssn' },
  { id: 'pii', label: 'Personal details', hint: 'pii' },
  { id: 'numbers', label: 'Every number', hint: 'numbers' },
] as const

type Kind = (typeof KINDS)[number]['id']

// What to read for each kind, all test values: the standard Visa test card, a made-up SSN, and a
// 555 number. Each line is something that kind was seen to redact in testing.
export const PHRASE: Record<Kind, string> = {
  pci: 'My card number is 4111 1111 1111 1111, and it expires 09/28.',
  ssn: 'My Social Security number is 123-45-6789.',
  pii: 'You can call me back at 415-555-0134.',
  numbers: 'My card number is 4111 1111 1111 1111, and you can call me back at 415-555-0134.',
}

// Flux takes one kind; Nova-3 takes them all.
export const FLUX_KINDS: readonly Kind[] = ['numbers']
const kindsFor = (endpoint: string): readonly Kind[] => (endpoint === 'v2' ? FLUX_KINDS : KINDS.map((k) => k.id))

// One line per ticked kind. With nothing ticked, everything, so run one has something to hide.
export function phrasesFor(kinds: readonly Kind[]): string[] {
  const on = sorted(kinds)
  return on.length ? on.map((k) => PHRASE[k]) : [PHRASE.pci, PHRASE.ssn, PHRASE.pii]
}


interface State {
  kinds: Kind[]
}

// Always in KINDS order, so the Request card reads the same however they were ticked.
const sorted = (kinds: readonly Kind[]) => KINDS.map((k) => k.id).filter((id) => kinds.includes(id))

// What Deepgram puts in place of a redacted span: a label on Nova-3, e.g. [CREDIT_CARD_1], or a
// bare * on Flux.
export const LABEL = /(\[[A-Z_]+_\d+\]|\*)/

function Redacted({ text }: { text: string }) {
  return (
    <>
      {text.split(LABEL).map((part, i) =>
        i % 2 ? (
          <mark key={i} className="redacted">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

function Transcript({ words, live }: { words: readonly Word[]; live: boolean }) {
  if (words.length === 0) {
    return <EmptyTranscript live={live} text="Your transcript shows up here, with redacted spans labeled." />
  }
  const committed = words.filter((w) => !w.pending).map((w) => w.text).join(' ')
  const pending = words.filter((w) => w.pending).map((w) => w.text).join(' ')
  return (
    <div className="transcript" aria-live="polite">
      <p className="transcript__text">
        <Redacted text={committed} /> <span className="word--pending">{pending}</span>
      </p>
    </div>
  )
}

export default defineFeature<State>({
  copy: {
    headline: 'Say the card number. Never store it.',
    lede: 'Read out a test card number or a made-up Social Security number. Pick what to redact, and Deepgram masks it before the transcript reaches your app.',
    ctaTitle: 'Add redact to your next request.',
    ctaBody: (
      <>
        On Flux, <code>redact=numbers</code> masks every number. On Nova-3, repeat it to combine
        kinds: <code>redact=pci&amp;redact=ssn</code>. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/redaction' },
  models: [
    {
      id: 'flux',
      label: 'Flux',
      endpoint: 'v2',
      params: { model: 'flux-general-en' },
      note: 'Flux takes redact=numbers only and swaps each number for *. Card, SSN and personal-detail redaction need Nova-3.',
    },
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3', smart_format: 'true' },
      note: 'Nova-3 takes every kind and labels each span, like [CREDIT_CARD_1].',
    },
  ],
  // Live mic only. Runs stay side by side so the same phrase can be read without, then with.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { kinds: [] },
  variants: [{ kinds: [] }, { kinds: ['pci'] }, { kinds: ['ssn'] }, { kinds: ['pii'] }, { kinds: ['numbers'] }, { kinds: ['pci', 'ssn', 'pii', 'numbers'] }],

  // Nothing ticked means no redact param at all.
  params({ kinds }, { model }): Params {
    const on = sorted(kinds).filter((k) => kindsFor(model.endpoint).includes(k))
    return on.length ? { redact: on } : {}
  },
  highlight: ['redact'],

  runLabel: ({ kinds }, { model }) => {
    const on = sorted(kinds).filter((k) => kindsFor(model.endpoint).includes(k))
    return on.length ? `redact ${on.join(' + ')}` : 'no redaction'
  },
  actionLabel: ({ kinds }, { model }) => {
    const on = sorted(kinds).filter((k) => kindsFor(model.endpoint).includes(k))
    return on.length ? `Run with redact ${on.join(' + ')}` : 'Run without redaction'
  },
  compareTip: ({ kinds }, { model }) =>
    model.endpoint === 'v2'
      ? kinds.includes('numbers')
        ? 'Untick Every number and run it again to compare.'
        : 'Tick Every number, then run it again to compare.'
      : kinds.length
        ? 'Tick a different set and run it again to compare.'
        : 'Tick Card numbers and Social Security numbers, then run it again to compare.',

  phrases: ({ kinds }, { model }) =>
    model.endpoint === 'v2' ? [PHRASE.numbers] : phrasesFor(kinds.filter((k) => kindsFor(model.endpoint).includes(k))),

  echo: (msg) => finalTranscript(msg),

  Controls({ state, setState, ctx }) {
    const toggle = (id: Kind, on: boolean) =>
      setState({ kinds: on ? sorted([...state.kinds, id]) : state.kinds.filter((k) => k !== id) })
    return (
      <fieldset className="redact-kinds" disabled={ctx.busy}>
        <legend>Redact</legend>
        {KINDS.filter((k) => kindsFor(ctx.model.endpoint).includes(k.id)).map((k) => (
          <label className="check" key={k.id}>
            <input type="checkbox" checked={state.kinds.includes(k.id)} onChange={(e) => toggle(k.id, e.target.checked)} />
            {k.label} <code className="redact-kinds__param">{k.hint}</code>
          </label>
        ))}
      </fieldset>
    )
  },

  // The last final transcript, verbatim, with the labels Deepgram put in marked.
  Response({ latest }) {
    if (typeof latest?.echoed !== 'string') {
      return <span className="wire__key">The last final transcript shows up here after a run.</span>
    }
    return (
      <span className="wire__part wire__part--text">
        <span className="wire__key">"transcript":</span> "<Redacted text={latest.echoed} />"
      </span>
    )
  },

  Result({ run, live }) {
    return <Transcript words={run ? [...run.committed, ...run.pending] : []} live={live} />
  },
})
