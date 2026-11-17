// diarize_model on Nova-3 pre-recorded: the same call through the v1 diarizer, then v2, side by side.
// Checked live 2026-11-16 with support-call.mp3 (two Deepgram Flux voices, flux-wes-en and
// flux-drew-en, six turns) on POST /v1/listen?model=nova-3&smart_format=true: diarize_model=v1 put
// every word on speaker 0; v2 and latest split all six turns correctly (0/1/0/1/0/1),
// and metadata.diarize_info.arch said v1, v2, v2. diarize_model=v2 is a 400 at the /v1/listen
// streaming handshake and on Flux /v2/listen, so this page is batch only, on Nova-3.
// Verified live 2026-11-16: pnpm verify:live passed (v1, v2, latest on the Sample and Record modes), and POST /v1/listen?model=nova-3&smart_format=true with a granted Bearer token on support-call.mp3 gave v1 speakers [0] (one speaker for all six turns), v2 and latest [0, 1, 0, 1, 0, 1] with diarize_info.arch v2.
import { defineFeature, type Json, type Params, type Word } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import clip from './support-call.mp3'
import './styles.css'

export type Diarizer = 'v1' | 'v2' | 'latest'
export const DIARIZERS: Diarizer[] = ['v1', 'v2', 'latest']

interface State {
  diarizer: Diarizer
}

export interface Turn {
  speaker: number | undefined
  words: Word[]
}

// Consecutive words from the same speaker become one row.
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
const name = (speaker: number | undefined) => (speaker === undefined ? 'No speaker' : `Speaker ${speaker + 1}`)

function Turns({ words, live }: { words: readonly Word[]; live: boolean }) {
  if (words.length === 0) {
    return <EmptyTranscript live={live} text="The transcript shows up here, one row per speaker turn." />
  }
  const rows = groupBySpeaker(words)
  const speakers = new Set(words.map((w) => w.speaker).filter((s) => s !== undefined)).size
  return (
    <div className="transcript" aria-live="polite">
      <p className="note dmv2-count">
        {speakers} {speakers === 1 ? 'speaker' : 'speakers'}, {rows.length} {rows.length === 1 ? 'turn' : 'turns'}
      </p>
      {rows.map((t, i) => (
        <div className="turn" data-slot={slot(t.speaker)} key={i}>
          <span className="turn__chip">{name(t.speaker)}</span>
          <p className="turn__words">{t.words.map((w) => w.text).join(' ')}</p>
        </div>
      ))}
    </div>
  )
}

// What support-call.mp3 says, two Deepgram voices taking turns. Also the script for Record.
export const SCRIPT = [
  'Person 1: Thanks for calling Acme support, this is Dan. How can I help?',
  'Person 2: Hi Dan. My order arrived yesterday, but the box was empty.',
  'Person 1: Sorry about that. What is the order number?',
  'Person 2: Four eight one five.',
  'Person 1: Got it. I will send a replacement today.',
  'Person 2: Great, thanks.',
]

export interface Echo {
  // metadata.diarize_info.arch: which diarizer actually ran.
  arch?: string
  words: { word: string; speaker?: number; confidence?: number }[]
}

// The diarizer that ran, and the first words of the response with their speaker labels.
export function echoBatch(json: Json): Echo | undefined {
  const results = json.results as Json | undefined
  if (!results) return undefined
  const info = (json.metadata as Json | undefined)?.diarize_info as Json | undefined
  const alt = ((results.channels as Json[] | undefined)?.[0]?.alternatives as Json[] | undefined)?.[0]
  const words = ((alt?.words as Json[] | undefined) ?? []).slice(0, 2).map((w) => ({
    word: String(w.punctuated_word ?? w.word ?? ''),
    ...(typeof w.speaker === 'number' ? { speaker: w.speaker } : {}),
    ...(typeof w.speaker_confidence === 'number' ? { confidence: Math.round(w.speaker_confidence * 100) / 100 } : {}),
  }))
  return { ...(typeof info?.arch === 'string' ? { arch: info.arch } : {}), words }
}

export default defineFeature<State>({
  copy: {
    headline: 'Same call, two diarizers.',
    lede: 'Send one short support call through the v1 diarizer, then v2, and compare who Deepgram says spoke each line. The sample is synthetic: two Deepgram text-to-speech voices, six turns.',
    ctaTitle: 'Add diarize_model=latest to your next pre-recorded request.',
    ctaBody: (
      <>
        On pre-recorded audio, <code>diarize_model=latest</code> runs the v2 diarizer today, and{' '}
        <code>v1</code> or <code>v2</code> pins one. Streaming takes <code>v1</code> or <code>latest</code>{' '}
        (the v1 diarizer). Each response names the one that ran in <code>metadata.diarize_info.arch</code>.
        New accounts start with $200 in free credit.
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
      note: 'Nova-3 only. Flux does not support diarize_model yet (/v2/listen answers it with a 400). diarize_model=v2 is pre-recorded only, so every run here is one POST.',
    },
  ],
  // The sample first: diarization needs two voices, and one visitor at a mic has one. Record is for
  // two people at one mic. Both keep the last two runs side by side.
  modes: [
    { id: 'sample', label: 'Sample call', source: 'sample', batch: true, sample: { url: clip, name: 'support-call.mp3' }, compare: true },
    { id: 'rec', label: 'Record', source: 'mic', batch: true, compare: true },
  ],
  // v1 first, so the second run is the one that changes.
  initialState: { diarizer: 'v1' },
  variants: DIARIZERS.map((diarizer) => ({ diarizer })),
  promptState: { diarizer: 'latest' },

  params: ({ diarizer }): Params => ({ diarize_model: diarizer }),
  highlight: ['diarize_model'],

  runLabel: ({ diarizer }) => `diarize_model=${diarizer}`,
  actionLabel: ({ diarizer }) => `Send with diarize_model=${diarizer}`,
  compareTip: ({ diarizer }) =>
    diarizer === 'v1' ? 'Pick v2 and send it again to compare.' : 'Pick v1 and send it again to compare.',

  // Record only: two people, taking turns at one mic. One voice reading both parts stays one speaker.
  phrases: () => SCRIPT,

  echo: (msg) => echoBatch(msg),

  Controls({ state, setState, ctx }) {
    return (
      <div className="segmented" role="radiogroup" aria-label="Diarizer">
        {DIARIZERS.map((d) => (
          <button
            key={d}
            role="radio"
            aria-checked={state.diarizer === d}
            className={state.diarizer === d ? 'segmented__opt is-on' : 'segmented__opt'}
            disabled={ctx.busy}
            onClick={() => setState({ diarizer: d })}
          >
            {d}
          </button>
        ))}
      </div>
    )
  },

  Response({ latest }) {
    const e = latest?.echoed as Echo | undefined
    if (!e) return <span className="wire__key">The diarizer that ran and the first words show up here after a run.</span>
    return (
      <>
        <span className="wire__part wire__part--text">
          <span className="wire__key">"diarize_info":</span> <mark>{`{ "arch": ${JSON.stringify(e.arch ?? null)} }`}</mark>
        </span>
        <span className="wire__part wire__part--text">
          <span className="wire__key">"words":</span> [
          {e.words.map((w, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {`{ "punctuated_word": ${JSON.stringify(w.word)}`}
              {w.speaker !== undefined && (
                <>
                  , <mark>"speaker": {w.speaker}</mark>
                </>
              )}
              {w.confidence !== undefined && `, "speaker_confidence": ${w.confidence}`}
              {' }'}
            </span>
          ))}
          , … ]
        </span>
      </>
    )
  },

  Result({ run, live }) {
    return <Turns words={run ? [...run.committed, ...run.pending] : []} live={live} />
  },
})
