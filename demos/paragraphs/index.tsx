// paragraphs on Nova-3, pre-recorded: the same recording comes back as one flat transcript, or
// split into paragraphs of sentences, each with start and end times.
// Checked 2026-11-16: paragraphs=true is a 400 at the socket handshake on /v1/listen (Nova-3) and
// /v2/listen (Flux), so this page records and sends one POST. paragraphs turns punctuation on by
// itself (paragraphs=true&punctuate=false still came back punctuated); the page sends
// punctuate=true either way so the off run is punctuated too and only the paragraphs differ. On
// macOS `say` clips, Deepgram started a new paragraph after every fifth sentence: a 6 s pause or a
// change of subject inside five sentences did not start one. So each topic in the phrase is five
// sentences, and the break lands on the change of subject.
import { defineFeature, type Json, type Params } from '../../shared/common/feature'
import { EmptyTranscript, PlainTranscript } from '../../shared/stt/PlainTranscript'
import './styles.css'

interface State {
  on: boolean
}

export interface Sentence {
  text: string
  start: number
  end: number
}

export interface Paragraph {
  sentences: Sentence[]
  num_words: number
  start: number
  end: number
}

// What a run keeps from the response: the flat transcript, and the paragraphs when they came back.
export interface Echo {
  transcript: string
  paragraphs?: Paragraph[]
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

// results.channels[0].alternatives[0] of a pre-recorded response, read into an Echo.
export function readParagraphs(json: Json): Echo | undefined {
  const channel = ((json.results as Json | undefined)?.channels as Json[] | undefined)?.[0]
  const alt = (channel?.alternatives as Json[] | undefined)?.[0]
  if (!alt) return undefined
  const transcript = String(alt.transcript ?? '')
  const list = ((alt.paragraphs as Json | undefined)?.paragraphs as Json[] | undefined) ?? undefined
  if (!list) return { transcript }
  const paragraphs = list.map((p) => ({
    sentences: ((p.sentences as Json[] | undefined) ?? []).map((s) => ({ text: String(s.text ?? ''), start: num(s.start), end: num(s.end) })),
    num_words: num(p.num_words),
    start: num(p.start),
    end: num(p.end),
  }))
  return { transcript, paragraphs }
}

const secs = (t: number) => `${t.toFixed(2)} s`

function Paragraphs({ paragraphs }: { paragraphs: Paragraph[] }) {
  return (
    <div className="transcript" aria-live="polite">
      {paragraphs.map((p, i) => (
        <section className="para" key={i}>
          <p className="para__head">
            Paragraph {i + 1} · {secs(p.start)} to {secs(p.end)} · {p.num_words} words
          </p>
          <ol className="para__sentences">
            {p.sentences.map((s, j) => (
              <li className="para__sentence" key={j}>
                <span className="para__time">
                  {s.start.toFixed(2)}–{s.end.toFixed(2)}
                </span>
                <span className="para__text">{s.text}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

// Two topics, five sentences each, about 20 to 25 seconds read aloud.
export const SCRIPT = [
  'We shipped the new billing page on Monday. Checkout is faster now. Failed payment tickets dropped by half. Invoices are next. The first draft is due Friday.',
  'On a different note, the kitchen gets a new espresso machine. It arrives Thursday morning. Please clear the counter by Wednesday. Oat milk is on the order too. Enjoy the coffee.',
]

export default defineFeature<State>({
  copy: {
    headline: 'A wall of text, or paragraphs?',
    lede: 'Record yourself reading both topics below, about 25 seconds. With paragraphs=true the response groups the transcript into paragraphs of sentences, each with start and end times. Run it off to see the same words as one block.',
    ctaTitle: 'Add paragraphs=true to your next pre-recorded request.',
    ctaBody: (
      <>
        <code>paragraphs</code> adds <code>paragraphs.paragraphs[]</code> to each alternative on a pre-recorded{' '}
        <code>/v1/listen</code> request: sentences with <code>start</code> and <code>end</code>, plus a{' '}
        <code>transcript</code> with line breaks between paragraphs. It turns punctuation on by itself. New accounts
        start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/paragraphs' },
  models: [
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3', punctuate: 'true' },
      note: 'Nova-3 only. Flux does not support paragraphs yet (/v2/listen answers it with a 400). Pre-recorded only: the streaming socket refuses it too, so Record keeps up to 30 seconds and sends one POST. In testing, a new paragraph started after five sentences; a pause or a change of subject alone did not start one.',
    },
  ],
  // Mic, pre-recorded. Runs stay side by side so the same reading can be compared off and on.
  modes: [{ id: 'rec', label: 'Record', source: 'mic', batch: true, compare: true }],
  initialState: { on: true },
  variants: [{ on: false }, { on: true }],
  promptState: { on: true },

  // Sent either way, so the Request card always says which one ran.
  params: ({ on }): Params => ({ paragraphs: String(on) }),
  highlight: ['paragraphs'],

  runLabel: ({ on }) => `paragraphs=${on}`,
  actionLabel: ({ on }) => `Run with paragraphs=${on}`,
  compareTip: ({ on }) =>
    on ? 'Turn paragraphs off and record it again to compare.' : 'Turn paragraphs on and record it again to compare.',

  phrases: () => SCRIPT,

  echo: (msg) => readParagraphs(msg),

  Controls({ state, setState, ctx }) {
    return (
      <label className="check">
        <input type="checkbox" checked={state.on} disabled={ctx.busy} onChange={(e) => setState({ on: e.target.checked })} />
        Turn on paragraphs
      </label>
    )
  },

  Response({ latest }) {
    const e = latest?.echoed as Echo | undefined
    if (!e) return <span className="wire__key">The paragraphs from the last response show up here after a run.</span>
    if (!e.paragraphs) {
      return (
        <span className="wire__part wire__part--text">
          <span className="wire__key">"transcript":</span> {JSON.stringify(e.transcript)}, and no{' '}
          <span className="wire__key">"paragraphs"</span>
        </span>
      )
    }
    const first = e.paragraphs[0]?.sentences[0]
    return (
      <span className="wire__part wire__part--text">
        <mark>"paragraphs"</mark>: {'{ '}
        <span className="wire__key">"paragraphs":</span> [
        {first && (
          <>
            {' { "sentences": [ { "text": '}
            {JSON.stringify(first.text)}, "start": {first.start}, "end": {first.end} {'}, … ], "num_words": '}
            {e.paragraphs[0].num_words} {'}'}
          </>
        )}
        , … ] {'}'} with <mark>{e.paragraphs.length}</mark> {e.paragraphs.length === 1 ? 'paragraph' : 'paragraphs'}
      </span>
    )
  },

  // Paragraphs of timed sentences when the run had them; the flat transcript when it did not.
  Result({ run, live }) {
    const e = run?.echoed as Echo | undefined
    if (run && e?.paragraphs?.length) return <Paragraphs paragraphs={e.paragraphs} />
    if (run) {
      return <PlainTranscript committed={run.committed} pending={run.pending} live={live} emptyText="No words came back. Try reading the phrase again." />
    }
    return <EmptyTranscript live={live} text="Your transcript shows up here, split into paragraphs." />
  },
})
