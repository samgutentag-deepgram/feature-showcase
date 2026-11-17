// detect_entities on Nova-3 streaming: Deepgram finds names, phone numbers, emails, dates,
// addresses, and amounts in what you say, and labels each one with where it sits in the transcript.
// Checked live 2026-11-16 on /v1/listen streaming with a macOS `say` clip sent in real time: each
// final Results message carries a top-level `entities` array (not inside channel.alternatives[0],
// where the docs show it), with label, value, confidence, start_word, end_word (end exclusive,
// counted in the transcript's own words), plus raw_value when smart_format is on. Interim results
// carry none. Flux (/v2/listen, flux-general-en) answers detect_entities=true with a 400.
// Verified live 2026-11-16: ONLY=detect-entities pnpm verify:live passed (both smart_format
// variants open on Nova-3), and the suggested phrase as a say clip streamed in real time came back
// with NAME, PHONE_NUMBER, EMAIL_ADDRESS, DATE, LOCATION_ADDRESS, LOCATION_CITY, and MONEY,
// confidence 0.93 to 0.99.
import { defineFeature, type Json, type Params, type Word } from '../../shared/common/feature'
import type { ReactNode } from 'react'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import './styles.css'

export interface Entity {
  label: string
  value: string
  raw_value?: string
  confidence: number
  start_word: number
  end_word: number
}

// One final result: its transcript, split the way start_word and end_word count, and its entities.
export interface Segment {
  words: string[]
  entities: Entity[]
}

export interface Found {
  segments: Segment[]
}

// Entities come per final result, with word positions inside that result. echo() sees one message
// at a time, so the finals of each session are collected here by request_id, which is unique per
// socket: two runs side by side never mix.
const sessions = new Map<string, Segment[]>()

export function entitiesOf(msg: Json): Entity[] {
  const list = msg.entities
  if (!Array.isArray(list)) return []
  return list.filter((e): e is Entity => typeof e === 'object' && e !== null && typeof (e as Entity).label === 'string')
}

export function collect(msg: Json): Found | undefined {
  if (msg.type !== 'Results' || msg.is_final !== true) return undefined
  const alt = ((msg.channel as Json | undefined)?.alternatives as Json[] | undefined)?.[0]
  const transcript = String(alt?.transcript ?? '').trim()
  if (!transcript) return undefined
  const id = String((msg.metadata as Json | undefined)?.request_id ?? '')
  const segments = [...(sessions.get(id) ?? []), { words: transcript.split(/\s+/), entities: entitiesOf(msg) }]
  sessions.set(id, segments)
  return { segments }
}

const isFound = (v: unknown): v is Found => typeof v === 'object' && v !== null && Array.isArray((v as Found).segments)

// The label each word falls under in one segment, or undefined.
export function labelAt(segment: Segment, i: number): Entity | undefined {
  return segment.entities.find((e) => i >= e.start_word && i < e.end_word)
}

// A segment's words, with each entity's span wrapped in one mark that carries its label.
function MarkedSegment({ segment }: { segment: Segment }) {
  const out: ReactNode[] = []
  let i = 0
  while (i < segment.words.length) {
    const e = labelAt(segment, i)
    if (e) {
      const end = Math.min(e.end_word, segment.words.length)
      out.push(
        <mark key={i} className="entity" title={`${e.label}, confidence ${e.confidence.toFixed(2)}`}>
          {segment.words.slice(i, end).join(' ')}
          <span className="entity__label">{e.label}</span>
        </mark>,
        ' ',
      )
      i = end
    } else {
      out.push(<span key={i}>{segment.words[i]} </span>)
      i++
    }
  }
  return <>{out}</>
}

function Transcript({ found, pending, live }: { found?: Found; pending: readonly Word[]; live: boolean }) {
  const segments = found?.segments ?? []
  if (segments.length === 0 && pending.length === 0) {
    return <EmptyTranscript live={live} text="Your transcript shows up here, with every entity Deepgram found marked and labeled." />
  }
  return (
    <div className="transcript" aria-live="polite">
      <p className="transcript__text">
        {segments.map((s, i) => (
          <MarkedSegment key={i} segment={s} />
        ))}
        <span className="word--pending">{pending.map((w) => w.text).join(' ')}</span>
      </p>
    </div>
  )
}

interface State {
  smart: boolean
}

export default defineFeature<State>({
  copy: {
    headline: 'Who, where, when, and how much?',
    lede: 'Read out a name, a phone number, an email, a date, an address, and an amount. Deepgram labels each one and says which words it covers, as you speak.',
    ctaTitle: 'Add detect_entities=true to your next request.',
    ctaBody: (
      <>
        <code>detect_entities</code> finds and labels entities on <code>/v1/listen</code>, pre-recorded
        and streaming (Nova models). It finds them; to hide them instead, see the{' '}
        <a href="../redact/">redact demo</a>. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/detect-entities' },
  models: [
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3' },
      note: 'Nova-3 only. Flux does not support detect_entities yet (/v2/listen answers it with a 400). On the socket, each final result carries a top-level entities array.',
    },
  ],
  // Live mic only. Runs stay side by side so the phrase can be read with smart_format on, then off.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { smart: true },
  variants: [{ smart: true }, { smart: false }],
  promptState: { smart: true },

  // smart_format is sent either way, so the card says which ran: on, values read like "(415)
  // 555-0134" and raw_value keeps the spoken words; off, values are the spoken words.
  params: ({ smart }): Params => ({ detect_entities: 'true', smart_format: String(smart) }),
  highlight: ['detect_entities'],

  runLabel: ({ smart }) => (smart ? 'detect_entities, smart_format on' : 'detect_entities, smart_format off'),
  actionLabel: ({ smart }) => `Run with smart_format=${smart}`,
  compareTip: ({ smart }) =>
    smart
      ? 'Turn smart_format off and run it again: the values come back as the words you said.'
      : 'Turn smart_format on and run it again: the values come back formatted, with raw_value beside them.',

  phrases: () => [
    'Hi, this is Maria Lopez. Call me at 415-555-0134, or email maria@example.com. Please deliver it on March 3rd, 2026, to 1200 Market Street in San Francisco. The total was $129.99.',
  ],

  echo: (msg) => collect(msg),

  Controls({ state, setState, ctx }) {
    return (
      <label className="check">
        <input
          type="checkbox"
          checked={state.smart}
          disabled={ctx.busy}
          onChange={(e) => setState({ smart: e.target.checked })}
        />
        Also send smart_format=true
      </label>
    )
  },

  // Every entity from the run's final results, as Deepgram sent them. start_word and end_word count
  // words inside the result each one came in.
  Response({ latest }) {
    const found = isFound(latest?.echoed) ? latest.echoed : undefined
    const all = found?.segments.flatMap((s) => s.entities) ?? []
    if (!found) {
      return <span className="wire__key">The entities array from each final result shows up here after a run.</span>
    }
    if (all.length === 0) {
      return <span className="wire__key">"entities": [] so far. Try a name, a phone number, or a date.</span>
    }
    return (
      <>
        <span className="wire__key">"entities":</span>
        {all.map((e, i) => (
          <span className="wire__part wire__part--text entity-line" key={i}>
            <span className="wire__key">label</span> <mark>{e.label}</mark>{' '}
            <span className="wire__key">value</span> {JSON.stringify(e.value)}{' '}
            {e.raw_value !== undefined && e.raw_value !== e.value && (
              <>
                <span className="wire__key">raw_value</span> {JSON.stringify(e.raw_value)}{' '}
              </>
            )}
            <span className="wire__key">confidence</span> {e.confidence.toFixed(2)}{' '}
            <span className="wire__key">start_word</span> {e.start_word}{' '}
            <span className="wire__key">end_word</span> {e.end_word}
          </span>
        ))}
      </>
    )
  },

  Result({ run, live }) {
    const found = isFound(run?.echoed) ? run.echoed : undefined
    return <Transcript found={found} pending={run?.pending ?? []} live={live} />
  },
})
