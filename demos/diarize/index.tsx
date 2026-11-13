// Diarization on Nova-3 streaming: every word comes back with a speaker index, and the page
// starts a new row each time it changes. Uses diarize_model, which replaced the deprecated boolean
// diarize. Verified live 2026-11-12 on /v1/listen streaming with samples/diarize.mp3 (two macOS
// voices, five turns): diarize_model=latest (v1 for streaming) labeled all five turns correctly.
// With no diarize_model, no speaker comes back. diarize_model=v2 is pre-recorded only and fails the
// streaming handshake, and Flux /v2/listen rejects diarize_model, so neither is offered here.
import { defineFeature, type Json, type Params, type Word } from '../../shared/common/feature'
import { EmptyTranscript, PlainTranscript } from '../../shared/stt/PlainTranscript'
import './styles.css'


interface State {
  on: boolean
}

export interface Turn {
  speaker: number | undefined
  words: Word[]
}

// Consecutive words from the same speaker become one row. A word with no speaker (interim
// results, or diarization off) stays with the row it follows.
export function groupBySpeaker(words: readonly Word[]): Turn[] {
  const rows: Turn[] = []
  for (const w of words) {
    const last = rows.at(-1)
    const speaker = w.speaker ?? last?.speaker
    if (last && last.speaker === speaker) last.words.push(w)
    else rows.push({ speaker, words: [w] })
  }
  return rows
}

// Three colors, then they repeat. Speaker indexes start at 0; people count from 1.
const slot = (speaker: number | undefined) => (speaker === undefined ? 'unknown' : String(speaker % 3))
const name = (speaker: number | undefined) => (speaker === undefined ? 'Listening' : `Speaker ${speaker + 1}`)

function Turns({ words, live }: { words: readonly Word[]; live: boolean }) {
  if (words.length === 0) {
    return <EmptyTranscript live={live} text="Your transcript shows up here, one row per speaker." />
  }
  return (
    <div className="transcript" aria-live="polite">
      {groupBySpeaker(words).map((t, i) => (
        <div className="turn" data-slot={slot(t.speaker)} key={i}>
          <span className="turn__chip">{name(t.speaker)}</span>
          <p className="turn__words">
            {t.words.map((w, j) => (
              <span key={j} className={w.pending ? 'word word--pending' : 'word'}>
                {w.text}{' '}
              </span>
            ))}
          </p>
        </div>
      ))}
    </div>
  )
}

// The same five turns as samples/diarize.mp3, which diarize_model=latest split correctly in testing.
export const SCRIPT = [
  'Person 1: Thanks for calling Acme support, this is Dana. How can I help?',
  'Person 2: Hi Dana. My order arrived yesterday, but the box was empty.',
  'Person 1: I am sorry about that. Can you read me the order number?',
  'Person 2: Sure, it is on the receipt. Give me one second to find it.',
  'Person 1: No problem. I will send a replacement today either way.',
]

interface Echo {
  word: string
  speaker?: number
}

export default defineFeature<State>({
  copy: {
    headline: 'Who said that?',
    lede: 'Grab someone nearby and read the script together. Turn on diarization and every word comes back tagged with its speaker, live.',
    ctaTitle: 'Add diarize_model=latest to your next request.',
    ctaBody: (
      <>
        <code>diarize_model</code> works on <code>/v1/listen</code>, streaming and pre-recorded, and adds a{' '}
        <code>speaker</code> to every word. It replaces the deprecated <code>diarize=true</code>. New accounts
        start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/diarization' },
  models: [
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3', smart_format: 'true' },
      note: 'Nova-3 only. Flux does not support diarization yet (/v2/listen rejects diarize_model). Streaming uses the v1 diarizer; v2 is pre-recorded only.',
    },
  ],
  // Live mic only. Runs stay side by side so the same script can be read without, then with.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { on: false },
  variants: [{ on: false }, { on: true }],

  // diarize_model has no "off" value, so the off run leaves it out.
  params: ({ on }, { model }): Params => (on ? { diarize_model: 'latest' } : {}),
  highlight: ['diarize_model'],

  runLabel: ({ on }, { model }) => (on ? 'diarize_model=latest' : 'no diarize_model'),
  actionLabel: ({ on }, { model }) => (on ? 'Run with diarize_model=latest' : 'Run without diarize_model'),
  compareTip: ({ on }) =>
    on ? 'Turn diarization off and run it again to compare.' : 'Turn diarization on and run it again to compare.',

  // The first few words of the last final result, with the speaker Deepgram gave each.
  // Two people, taking turns at one mic. One voice reading both parts stays one speaker.
  phrases: () => SCRIPT,

  echo(msg) {
    if (msg.type !== 'Results' || msg.is_final !== true) return undefined
    const alt = ((msg.channel as Json | undefined)?.alternatives as Json[] | undefined)?.[0]
    const words = (alt?.words as Json[] | undefined) ?? []
    if (!words.length) return undefined
    return words.slice(0, 3).map((w): Echo => ({
      word: String(w.punctuated_word ?? w.word ?? ''),
      ...(typeof w.speaker === 'number' ? { speaker: w.speaker } : {}),
    }))
  },

  Controls({ state, setState, ctx }) {
    return (
      <label className="check">
        <input type="checkbox" checked={state.on} disabled={ctx.busy} onChange={(e) => setState({ on: e.target.checked })} />
        Turn on diarization
      </label>
    )
  },

  Response({ latest }) {
    const words = latest?.echoed as Echo[] | undefined
    if (!words) return <span className="wire__key">The last final result's words show up here after a run.</span>
    return (
      <span className="wire__part wire__part--text">
        <span className="wire__key">"words":</span> [
        {words.map((w, i) => (
          <span key={i}>
            {i > 0 && ', '}
            {'{ "punctuated_word": '}
            {JSON.stringify(w.word)}
            {w.speaker !== undefined && (
              <>
                , <mark>"speaker": {w.speaker}</mark>
              </>
            )}
            {' }'}
          </span>
        ))}
        , … ]
      </span>
    )
  },

  // Rows per speaker when the run had diarization on; one block of text when it did not.
  Result({ run, live }) {
    if (run && !run.state.on) {
      return <PlainTranscript committed={run.committed} pending={run.pending} live={live} emptyText="" />
    }
    return <Turns words={run ? [...run.committed, ...run.pending] : []} live={live} />
  },
})
