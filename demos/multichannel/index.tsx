// multichannel on Nova-3 pre-recorded: one stereo call, agent on the left channel and customer on the
// right, sent with multichannel=false (mixed to one channel) and then true (one transcript per channel).
// Checked live 2026-11-16 with call-stereo.mp3 (two Deepgram Flux voices, flux-wes-en on the left and
// flux-drew-en on the right, six lines) on POST /v1/listen?model=nova-3&smart_format=true:
// multichannel=false gave metadata.channels 1 and one transcript with all six lines run together;
// true gave metadata.channels 2, channel 0 "Thanks for calling Acme support. This is Dan. How can I
// help? Sorry about that. What is the order number? Got it. I will send a replacement today." and
// channel 1 "Hi, Dan. My order arrived yesterday, but the box was empty. 4815. Great. Thanks."
// Streaming: /v1/listen with multichannel=true&channels=2 opens (101) and tags each Results with
// channel_index [0,2] or [1,2]; Flux /v2/listen answers 400 "Unknown query parameters: channels,
// multichannel". A browser mic records one channel, so this page sends the bundled stereo sample.
// Verified live 2026-11-16: pnpm verify:live passed (multichannel=false and true on the Stereo call sample), and POST /v1/listen?model=nova-3&smart_format=true on call-stereo.mp3 gave metadata.channels 1 with all six lines in one transcript for false, and metadata.channels 2 for true: channel 0 holds the three agent lines, channel 1 the three customer lines ("Hi, Dan. My order arrived yesterday, but the box was empty. 4815. Great. Thanks.").
import { defineFeature, type Json, type Params, type Word } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import clip from './call-stereo.mp3'
import './styles.css'

interface State {
  multichannel: boolean
}

// Which side of the sample is which. Channel indexes follow the file: 0 is left, 1 is right.
export const SIDES = ['Left channel: agent', 'Right channel: customer']
const side = (c: number) => SIDES[c] ?? `Channel ${c + 1}`

// What call-stereo.mp3 says, in order. Agent lines are on the left channel, customer lines on the right.
export const SCRIPT = [
  'Agent: Thanks for calling Acme support, this is Dan. How can I help?',
  'Customer: Hi Dan. My order arrived yesterday, but the box was empty.',
  'Agent: Sorry about that. What is the order number?',
  'Customer: Four eight one five.',
  'Agent: Got it. I will send a replacement today.',
  'Customer: Great, thanks.',
]

export interface Line {
  channel: number
  start: number
  text: string
}

export interface Echo {
  // metadata.channels: how many channels Deepgram transcribed.
  channels: number
  // Each channel's results.channels[i].alternatives[0].transcript.
  transcripts: string[]
  // Every channel cut into lines at pauses longer than GAP_S, in time order across channels.
  lines: Line[]
}

// On one channel, a pause this long means the other side was talking.
export const GAP_S = 1

export function echoBatch(json: Json): Echo | undefined {
  const results = json.results as Json | undefined
  const chans = (results?.channels as Json[] | undefined) ?? []
  if (chans.length === 0) return undefined
  const lines: Line[] = []
  const transcripts = chans.map((ch, c) => {
    const alt = (ch.alternatives as Json[] | undefined)?.[0]
    let line: Line | undefined
    let last = -Infinity
    for (const w of (alt?.words as Json[] | undefined) ?? []) {
      const start = Number(w.start ?? 0)
      const text = String(w.punctuated_word ?? w.word ?? '')
      if (line && start - last <= GAP_S) line.text += ` ${text}`
      else lines.push((line = { channel: c, start, text }))
      last = Number(w.end ?? start)
    }
    return String(alt?.transcript ?? '')
  })
  const meta = (json.metadata as Json | undefined)?.channels
  return { channels: typeof meta === 'number' ? meta : chans.length, transcripts, lines: lines.sort((a, b) => a.start - b.start) }
}

// Without the echo (it should always be there), fall back to the words the page kept.
function fromWords(words: readonly Word[]): Line[] {
  const lines: Line[] = []
  for (const w of words) {
    const c = w.channel ?? 0
    const last = lines.at(-1)
    if (last && last.channel === c) last.text += ` ${w.text}`
    else lines.push({ channel: c, start: 0, text: w.text })
  }
  return lines
}

function Columns({ lines, channels }: { lines: Line[]; channels: number }) {
  if (channels < 2) {
    return (
      <div className="transcript mc" aria-live="polite">
        <p className="note mc-count">1 channel: both voices mixed into one transcript</p>
        <div className="mc-mixed">
          <span className="mc-head">Mixed (left + right)</span>
          <p className="mc-words">{lines.map((l) => l.text).join(' ')}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="transcript mc" aria-live="polite">
      <p className="note mc-count">{channels} channels, one transcript each, lined up by time</p>
      <div className="mc-grid" style={{ gridTemplateColumns: `repeat(${channels}, minmax(0, 1fr))` }}>
        {Array.from({ length: channels }, (_, c) => (
          <span className="mc-head" data-ch={c % 2} key={`h${c}`} style={{ gridColumn: c + 1 }}>
            {side(c)}
          </span>
        ))}
        {lines.map((l, i) => (
          <p className="mc-line" data-ch={l.channel % 2} key={i} style={{ gridColumn: l.channel + 1, gridRow: i + 2 }}>
            {l.text}
          </p>
        ))}
      </div>
    </div>
  )
}

const short = (s: string, n = 6) => {
  const words = s.split(' ')
  return words.length > n ? `${words.slice(0, n).join(' ')} …` : s
}

export default defineFeature<State>({
  copy: {
    headline: 'Agent on the left, customer on the right.',
    lede: 'Send one stereo support call with multichannel off, then on. Off, Deepgram mixes both sides into one transcript. On, it transcribes each channel on its own, so you know who said what without guessing. The sample is synthetic: two Deepgram text-to-speech voices, one per channel.',
    ctaTitle: 'Add multichannel=true when each speaker has their own channel.',
    ctaBody: (
      <>
        Call center recordings often put the agent on one channel and the caller on the other. With{' '}
        <code>multichannel=true</code>, <code>results.channels</code> has one entry per channel, each with its own
        transcript and word timings. It works pre-recorded and streaming on <code>/v1/listen</code>; a raw stereo stream
        also sends <code>channels=2</code>. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/multichannel' },
  models: [
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3', smart_format: 'true' },
      note: 'Nova-3 only. Flux does not support multichannel yet (/v2/listen answers it with a 400). A browser mic records one channel, so this page sends a bundled stereo clip in one POST.',
    },
  ],
  // The sample only: multichannel needs two channels, and a browser mic gives one.
  modes: [{ id: 'sample', label: 'Stereo call', source: 'sample', batch: true, sample: { url: clip, name: 'call-stereo.mp3' }, compare: true }],
  // Off first, so the second run is the one that changes.
  initialState: { multichannel: false },
  variants: [{ multichannel: false }, { multichannel: true }],
  promptState: { multichannel: true },

  // Sent either way, so the Request card always says which one ran.
  params: ({ multichannel }): Params => ({ multichannel: String(multichannel) }),
  highlight: ['multichannel'],

  runLabel: ({ multichannel }) => `multichannel=${multichannel}`,
  actionLabel: ({ multichannel }) => `Send with multichannel=${multichannel}`,
  compareTip: ({ multichannel }) =>
    multichannel ? 'Turn multichannel off and send it again to compare.' : 'Turn multichannel on and send it again to compare.',

  phrases: () => SCRIPT,

  echo: (msg) => echoBatch(msg),

  Controls({ state, setState, ctx }) {
    return (
      <label className="check">
        <input
          type="checkbox"
          checked={state.multichannel}
          disabled={ctx.busy}
          onChange={(e) => setState({ multichannel: e.target.checked })}
        />
        Turn on multichannel
      </label>
    )
  },

  Response({ latest }) {
    const e = latest?.echoed as Echo | undefined
    if (!e) return <span className="wire__key">The channel count and each channel's transcript show up here after a run.</span>
    return (
      <>
        <span className="wire__part wire__part--text">
          <span className="wire__key">"metadata":</span> {'{ '}
          <mark>"channels": {e.channels}</mark>
          {', … }'}
        </span>
        <span className="wire__part wire__part--text">
          <span className="wire__key">"channels":</span> [
          {e.transcripts.map((t, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {'{ "alternatives": [{ '}
              <mark>"transcript": {JSON.stringify(short(t))}</mark>
              {' }] }'}
            </span>
          ))}
          ]
        </span>
      </>
    )
  },

  Result({ run, live }) {
    if (!run || (run.committed.length === 0 && run.pending.length === 0)) {
      return <EmptyTranscript live={live} text="The transcript shows up here: one block mixed, or one column per channel." />
    }
    const e = run.echoed as Echo | undefined
    const words = [...run.committed, ...run.pending]
    const channels = e?.channels ?? new Set(words.map((w) => w.channel ?? 0)).size
    return <Columns lines={e?.lines ?? fromWords(words)} channels={channels} />
  },
})
